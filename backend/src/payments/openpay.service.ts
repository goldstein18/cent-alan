import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BalanceService } from '../balance/balance.service';
import { SupabaseService } from '../supabase/supabase.service';
import { OpenPayCreateCashReferenceDto } from './dto/openpay.dto';

type OpenPayCharge = {
  id: string;
  status?: string;
  authorization?: string;
  order_id?: string;
  amount?: number;
  creation_date?: string;
  operation_date?: string;
};

@Injectable()
export class OpenPayService {
  private readonly merchantId: string;
  private readonly privateKey: string;
  private readonly apiUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
    private readonly balanceService: BalanceService
  ) {
    this.merchantId = this.configService.get<string>('OPENPAY_MERCHANT_ID', '');
    this.privateKey = this.configService.get<string>('OPENPAY_PRIVATE_KEY', '');
    this.apiUrl = this.configService.get<string>('OPENPAY_API_URL', 'https://sandbox-api.openpay.mx/v1');
  }

  private ensureConfigured() {
    if (!this.merchantId || !this.privateKey) {
      throw new Error('OpenPay no configurado. Define OPENPAY_MERCHANT_ID y OPENPAY_PRIVATE_KEY');
    }
  }

  private getBasicAuthHeader() {
    const encoded = Buffer.from(`${this.privateKey}:`).toString('base64');
    return `Basic ${encoded}`;
  }

  private buildPhoneVariants(phoneNumber: string) {
    const digits = (phoneNumber || '').replace(/\D/g, '');
    if (!digits) {
      return [];
    }
    const variants = new Set<string>();
    variants.add(digits);

    const addLast10 = (value: string) => {
      const last10 = value.slice(-10);
      variants.add(last10);
      variants.add(`52${last10}`);
      variants.add(`521${last10}`);
      variants.add(`+52${last10}`);
      variants.add(`+521${last10}`);
    };

    if (digits.length >= 10) {
      addLast10(digits);
    }

    return Array.from(variants);
  }

  private async resolveUserIdForDeposit(defaultUserId: string, phoneNumber?: string) {
    if (!phoneNumber) {
      return { targetUserId: defaultUserId, targetPhone: null };
    }

    const client = this.supabaseService.getAdminClient() ?? this.supabaseService.getClient();
    if (!client) {
      throw new Error('No hay cliente de base de datos disponible para resolver número de teléfono');
    }

    const variants = this.buildPhoneVariants(phoneNumber);
    if (variants.length === 0) {
      throw new Error('Número de teléfono inválido');
    }

    const phoneOr = variants.map(v => `phone_number.eq.${v}`).join(',');
    const { data, error } = await client
      .from('app_users')
      .select('id, phone_number')
      .or(phoneOr)
      .limit(1);

    if (error) {
      throw error;
    }
    if (!data || data.length === 0) {
      throw new Error('No existe usuario CENT asociado al número de teléfono');
    }

    return { targetUserId: data[0].id as string, targetPhone: data[0].phone_number as string | null };
  }

  private async findTransactionByReference(userId: string, reference: string) {
    const client = this.supabaseService.getAdminClient() ?? this.supabaseService.getClient();
    if (!client) {
      return null;
    }

    const { data, error } = await client
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('reference', reference)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  private async updateTransactionByReference(reference: string, patch: Record<string, any>) {
    const client = this.supabaseService.getAdminClient() ?? this.supabaseService.getClient();
    if (!client) {
      return;
    }

    const { error } = await client
      .from('transactions')
      .update(patch)
      .eq('reference', reference);

    if (error) {
      throw error;
    }
  }

  private isFinalSuccessStatus(status?: string) {
    return status === 'completed' || status === 'chargeback_pending';
  }

  private isFinalFailedStatus(status?: string) {
    return status === 'failed' || status === 'cancelled' || status === 'refunded';
  }

  private isOpenPayEnabled(): boolean {
    const enabled = this.configService.get<string>('OPENPAY_ENABLED', 'false');
    return enabled === 'true' || enabled === '1';
  }

  async createCashDepositReference(userId: string, dto: OpenPayCreateCashReferenceDto) {
    const { targetUserId, targetPhone } = await this.resolveUserIdForDeposit(userId, dto.phoneNumber);
    const reference = `DEP-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // Modo bypass: OpenPay no está activo, aprobar el abono directamente
    if (!this.isOpenPayEnabled()) {
      await this.supabaseService.createTransaction({
        user_id: targetUserId,
        type: 'deposit',
        amount: dto.amount,
        description: 'Abono en efectivo',
        reference,
        status: 'completed',
        metadata: {
          provider: 'manual',
          depositTargetPhone: targetPhone || dto.phoneNumber || null,
          balanceApplied: true,
        },
      });

      await this.balanceService.addBalance(targetUserId, dto.amount, reference, 'Abono en efectivo');

      return {
        reference,
        chargeId: null,
        status: 'completed',
        amount: dto.amount,
        userId: targetUserId,
        targetPhone: targetPhone || dto.phoneNumber || null,
        paymentMethod: { type: 'manual', reference, barcodeUrl: null, paymentLimitDate: null },
        requiresWebhookConfirmation: false,
      };
    }

    // Modo OpenPay activo
    this.ensureConfigured();
    const payload = {
      method: 'store',
      amount: dto.amount,
      currency: 'MXN',
      description: 'Abono en efectivo a cuenta CENT',
      order_id: reference,
      customer: { name: 'Usuario', last_name: 'CENT', email: 'user@cent.local' },
    };

    const response = await fetch(`${this.apiUrl}/${this.merchantId}/charges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: this.getBasicAuthHeader() },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    let data: any = {};
    try { data = responseText ? JSON.parse(responseText) : {}; } catch { data = { raw: responseText }; }

    if (!response.ok) {
      const desc = data?.description || data?.error_code || `HTTP ${response.status}`;
      throw new Error(`OpenPay create charge error: ${desc}`);
    }

    const charge = data as OpenPayCharge;
    const status = charge.status || 'in_progress';
    const paymentMethod = (data as any).payment_method || {};

    await this.supabaseService.createTransaction({
      user_id: targetUserId,
      type: 'deposit',
      amount: dto.amount,
      description: payload.description,
      reference,
      status: this.isFinalSuccessStatus(status) ? 'completed' : this.isFinalFailedStatus(status) ? 'failed' : 'pending',
      metadata: {
        provider: 'openpay',
        openpayMethod: 'store',
        openpayChargeId: charge.id,
        openpayStatus: status,
        openpayAuthorization: charge.authorization,
        openpayOperationDate: charge.operation_date,
        openpayCreationDate: charge.creation_date,
        openpayPaymentReference: paymentMethod.reference,
        openpayBarcodeUrl: paymentMethod.barcode_url,
        openpayPaymentMethodType: paymentMethod.type,
        openpayPaymentLimitDate: paymentMethod.payment_date,
        depositTargetPhone: targetPhone || dto.phoneNumber || null,
        balanceApplied: false,
      },
    });

    if (this.isFinalSuccessStatus(status)) {
      await this.balanceService.addBalance(targetUserId, dto.amount, reference, 'Abono con OpenPay');
      await this.updateTransactionByReference(reference, {
        metadata: {
          provider: 'openpay',
          openpayChargeId: charge.id,
          openpayStatus: status,
          openpayAuthorization: charge.authorization,
          openpayPaymentReference: paymentMethod.reference,
          openpayBarcodeUrl: paymentMethod.barcode_url,
          openpayPaymentMethodType: paymentMethod.type,
          openpayPaymentLimitDate: paymentMethod.payment_date,
          depositTargetPhone: targetPhone || dto.phoneNumber || null,
          balanceApplied: true,
        },
      });
    }

    return {
      reference,
      chargeId: charge.id,
      status,
      amount: dto.amount,
      userId: targetUserId,
      targetPhone: targetPhone || dto.phoneNumber || null,
      paymentMethod: {
        type: paymentMethod.type || 'store',
        reference: paymentMethod.reference,
        barcodeUrl: paymentMethod.barcode_url,
        paymentLimitDate: paymentMethod.payment_date,
      },
      requiresWebhookConfirmation: !this.isFinalSuccessStatus(status),
    };
  }

  async getDepositStatus(userId: string, reference: string) {
    const tx = await this.findTransactionByReference(userId, reference);
    if (!tx) {
      throw new Error('No se encontró la referencia de abono');
    }
    const metadata = tx.metadata || {};
    return {
      reference: tx.reference,
      status: tx.status,
      amount: tx.amount,
      openpayStatus: metadata.openpayStatus,
      openpayChargeId: metadata.openpayChargeId,
      paymentMethod: {
        type: metadata.openpayPaymentMethodType,
        reference: metadata.openpayPaymentReference,
        barcodeUrl: metadata.openpayBarcodeUrl,
        paymentLimitDate: metadata.openpayPaymentLimitDate,
      },
      balanceApplied: metadata.balanceApplied === true,
      createdAt: tx.created_at,
    };
  }

  async processWebhook(rawBody: any) {
    const eventType = rawBody?.type || rawBody?.event_type || 'unknown';
    const transaction = rawBody?.transaction || rawBody?.data?.object || rawBody?.data || {};
    const status = transaction?.status as string | undefined;
    const reference = transaction?.order_id as string | undefined;
    const chargeId = transaction?.id as string | undefined;

    if (!reference) {
      return { ok: true, ignored: true, reason: 'Webhook sin order_id/reference' };
    }

    const client = this.supabaseService.getAdminClient() ?? this.supabaseService.getClient();
    if (!client) {
      throw new BadRequestException('Supabase no configurado');
    }

    const { data: tx, error } = await client
      .from('transactions')
      .select('*')
      .eq('reference', reference)
      .maybeSingle();

    if (error) {
      throw error;
    }
    if (!tx) {
      return { ok: true, ignored: true, reason: 'Transacción no encontrada', reference };
    }

    const metadata = tx.metadata || {};
    if (metadata.balanceApplied === true && this.isFinalSuccessStatus(status)) {
      return { ok: true, ignored: true, reason: 'Webhook duplicado (saldo ya aplicado)', reference, status };
    }

    if (this.isFinalSuccessStatus(status)) {
      await this.balanceService.addBalance(tx.user_id, Number(tx.amount || 0), reference, 'Abono con OpenPay');
      await client
        .from('transactions')
        .update({
          status: 'completed',
          metadata: {
            ...metadata,
            provider: 'openpay',
            openpayChargeId: chargeId || metadata.openpayChargeId,
            openpayStatus: status,
            balanceApplied: true,
            lastWebhookEventType: eventType,
          },
        })
        .eq('reference', reference);

      return { ok: true, updated: true, reference, status };
    }

    if (this.isFinalFailedStatus(status)) {
      await client
        .from('transactions')
        .update({
          status: 'failed',
          metadata: {
            ...metadata,
            provider: 'openpay',
            openpayChargeId: chargeId || metadata.openpayChargeId,
            openpayStatus: status,
            balanceApplied: false,
            lastWebhookEventType: eventType,
          },
        })
        .eq('reference', reference);

      return { ok: true, updated: true, reference, status };
    }

    await client
      .from('transactions')
      .update({
        metadata: {
          ...metadata,
          provider: 'openpay',
          openpayChargeId: chargeId || metadata.openpayChargeId,
          openpayStatus: status,
          lastWebhookEventType: eventType,
        },
      })
      .eq('reference', reference);

    return { ok: true, updated: true, reference, status: status || 'unknown' };
  }
}
