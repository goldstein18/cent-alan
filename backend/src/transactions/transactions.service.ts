import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { BalanceService } from '../balance/balance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ReferralsService } from '../referrals/referrals.service';
import { SupabaseService } from '../supabase/supabase.service';
import { DepositDto, PaymentDto, TransactionFilters, TransferExternalDto, TransferInternalDto } from '../types/transaction';

@Injectable()
export class TransactionsService {
  constructor(
    private supabaseService: SupabaseService,
    private balanceService: BalanceService,
    private notificationsService: NotificationsService,
    private referralsService: ReferralsService,
  ) {}

  async getTransactions(userId: string, phoneNumber: string | undefined, filters: TransactionFilters) {
    try {
      if (userId && phoneNumber) {
        const linked = await this.supabaseService.linkPosDepositsToUser(userId, phoneNumber);
        for (const amount of linked.amounts) {
          this.notificationsService.notifyDeposit(userId, amount);
        }
      }
    } catch (linkError) {
      console.error('Link POS deposits error (getTransactions):', linkError);
    }

    return this.supabaseService.getTransactions(userId, filters);
  }

  async getExternalTransfers(userId: string, limit?: number) {
    return this.supabaseService.getExternalTransfers(userId, limit);
  }

  private async verifyPin(userId: string, pin: string): Promise<boolean> {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new BadRequestException('Supabase no configurado');
    }

    const { data: user, error } = await client
      .from('app_users')
      .select('pin, password_salt')
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Verificar PIN usando SHA1 con salt (mismo algoritmo que login)
    const pinWithSalt = pin + (user.password_salt || '');
    const hashedPin = crypto.createHash('sha1').update(pinWithSalt).digest('hex');

    return hashedPin.toLowerCase() === user.pin.toLowerCase();
  }

  async transferInternal(userId: string, transferDto: TransferInternalDto, senderPhone?: string) {
    // Verificar PIN
    const isValidPin = await this.verifyPin(userId, transferDto.pin);
    if (!isValidPin) {
      throw new UnauthorizedException('PIN incorrecto');
    }

    // Verificar balance disponible usando cálculo dinámico
    const availableBalance = await this.balanceService.getAvailableBalance(userId);
    if (availableBalance.availableBalance < transferDto.amount) {
      throw new Error(
        `Saldo insuficiente. Disponible: $${availableBalance.availableBalance.toFixed(2)}, Solicitado: $${transferDto.amount.toFixed(2)}`
      );
    }

    const recipient = await this.supabaseService.getUser(transferDto.toPhoneNumber);
    if (!recipient?.id) {
      throw new Error('No se encontró la cuenta destino para la transferencia');
    }

    if (recipient.id === userId) {
      throw new Error('No puedes transferirte a tu misma cuenta');
    }

    const reference = `INT-${Date.now()}`;

    // Registrar transacción del emisor
    const senderTransaction = await this.supabaseService.createTransaction({
      user_id: userId,
      type: 'internal_transfer',
      amount: transferDto.amount,
      description: transferDto.description,
      reference,
      to_account: recipient.phone_number ?? transferDto.toPhoneNumber,
      status: 'completed',
    });

    // Primero deducir al emisor; si falla no intentamos acreditar
    // deductFromTotal=true: en transferencias el dinero sale de la cuenta (baja total y available)
    await this.balanceService.deductBalance(
      userId,
      transferDto.amount,
      reference,
      'Transferencia interna enviada',
      true
    );

    try {
      // Acreditar al receptor
      await this.balanceService.addBalance(
        recipient.id,
        transferDto.amount,
        reference,
        `Transferencia recibida de ${userId}`
      );

      // Registrar transacción de entrada para trazabilidad del receptor
      await this.supabaseService.createTransaction({
        user_id: recipient.id,
        type: 'deposit',
        amount: transferDto.amount,
        description: `Transferencia interna recibida`,
        reference,
        to_account: recipient.phone_number ?? transferDto.toPhoneNumber,
        status: 'completed',
      });

      // Notificar a emisor y receptor (fire-and-forget)
      this.notificationsService.notifyTransferSent(userId, transferDto.amount, transferDto.toPhoneNumber);
      // senderPhone: teléfono del emisor para mostrar como origen en la notificación del receptor
      this.notificationsService.notifyTransferReceived(recipient.id, transferDto.amount, senderPhone ?? 'un usuario CENT');

      // Verificar si este abono activa la recompensa de referido (fire-and-forget)
      this.referralsService.checkAndRewardReferrer(recipient.id).catch(() => {});
    } catch (creditError) {
      // Revertir el cargo al emisor para evitar pérdida de saldo en fallos parciales
      await this.balanceService.addBalance(
        userId,
        transferDto.amount,
        `${reference}-REV`,
        'Reversa por fallo al acreditar transferencia interna'
      );
      // Notificar fallo al emisor
      this.notificationsService.notifyTransferFailed(userId, transferDto.amount, transferDto.toPhoneNumber);
      throw creditError;
    }

    return senderTransaction;
  }

  async transferExternal(userId: string, transferDto: TransferExternalDto) {
    // Verificar PIN
    const isValidPin = await this.verifyPin(userId, transferDto.pin);
    if (!isValidPin) {
      throw new UnauthorizedException('PIN incorrecto');
    }

    // Verificar balance disponible usando cálculo dinámico
    const availableBalance = await this.balanceService.getAvailableBalance(userId);
    if (availableBalance.availableBalance < transferDto.amount) {
      throw new Error(
        `Saldo insuficiente. Disponible: $${availableBalance.availableBalance.toFixed(2)}, Solicitado: $${transferDto.amount.toFixed(2)}`
      );
    }

    const reference = `EXT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const transactionData = {
      user_id: userId,
      type: 'external_transfer',
      amount: transferDto.amount,
      description: transferDto.description,
      reference,
      bank_name: transferDto.bankName,
      clabe: transferDto.clabe,
      status: 'pending',
    };

    const transaction = await this.supabaseService.createTransaction(transactionData);

    // Deduct balance immediately (even while pending)
    // deductFromTotal=true: transferencia externa sale de la cuenta (baja total y available)
    await this.balanceService.deductBalance(
      userId,
      transferDto.amount,
      transaction.reference,
      'Transferencia externa',
      true
    );

    await this.supabaseService.createExternalTransfer(userId, {
      beneficiaryName: transferDto.beneficiaryName,
      bankName: transferDto.bankName,
      clabe: transferDto.clabe,
      amount: transferDto.amount,
      description: transferDto.description,
      reference: transaction.reference,
      status: transaction.status,
      transactionId: transaction.id,
    });

    // Notificar transferencia enviada (fire-and-forget)
    this.notificationsService.notifyTransferSent(userId, transferDto.amount, transferDto.clabe);

    return transaction;
  }

  async deposit(userId: string, depositDto: DepositDto) {
    const transactionData = {
      user_id: userId,
      type: 'deposit',
      amount: depositDto.amount,
      description: depositDto.description,
      reference: depositDto.reference,
      status: 'completed',
    };

    return this.supabaseService.createTransaction(transactionData);
  }

  async payment(userId: string, paymentDto: PaymentDto) {
    const transactionData = {
      user_id: userId,
      type: 'payment',
      amount: paymentDto.amount,
      description: paymentDto.description,
      reference: paymentDto.reference,
      status: 'completed',
    };

    return this.supabaseService.createTransaction(transactionData);
  }
}
