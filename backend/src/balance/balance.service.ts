import { BadRequestException, Injectable } from '@nestjs/common';
import { isInvestmentDomiciliation, resolveInvestmentLifecycle } from '../investments/investment-classification';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class BalanceService {
  constructor(
    private supabaseService: SupabaseService,
    private notificationsService: NotificationsService,
  ) {}

  private toFiniteNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  async getUserBalance(userId: string) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    const { data, error } = await this.supabaseService.getClient()
      .from('app_users')
      .select('available_balance, total_balance, last_balance_update')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data;
  }

  async updateUserBalance(userId: string) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    // Ejecutar función de cálculo de balance
    const { data, error } = await this.supabaseService.getClient()
      .rpc('calculate_available_balance', { user_id_param: userId });

    if (error) throw error;

    // Actualizar balance en la tabla
    const { error: updateError } = await this.supabaseService.getClient()
      .from('app_users')
      .update({
        available_balance: data,
        total_balance: await this.calculateTotalBalance(userId),
        last_balance_update: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    return { message: 'Balance updated successfully' };
  }

  async addBalance(userId: string, amount: number, reference: string, description?: string) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    // Obtener balance actual
    const currentBalance = await this.getUserBalance(userId);
    const newAvailable = currentBalance.available_balance + amount;
    const newTotal = (currentBalance.total_balance ?? currentBalance.available_balance) + amount;

    // Actualizar balance (ambos campos para que la app refleje el cambio correctamente)
    const { error: updateError } = await this.supabaseService.getClient()
      .from('app_users')
      .update({
        available_balance: newAvailable,
        total_balance: newTotal,
        last_balance_update: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Registrar transacción de balance
    await this.supabaseService.getClient()
      .from('balance_transactions')
      .insert({
        user_id: userId,
        type: 'deposit',
        amount: amount,
        balance_before: currentBalance.available_balance,
        balance_after: newAvailable,
        reference: reference,
        description: description || 'Abono desde POS'
      });

    // Notificar depósito (fire-and-forget, errors handled internally)
    // Verificar si es el primer depósito para usar mensaje de bienvenida
    (async () => {
      try {
        const { count } = await this.supabaseService.getClient()
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('type', 'deposit')
          .eq('status', 'completed');
        if (count === 1) {
          this.notificationsService.notifyFirstDeposit(userId, amount);
        } else {
          this.notificationsService.notifyDeposit(userId, amount);
        }
      } catch {
        this.notificationsService.notifyDeposit(userId, amount);
      }
    })();

    return { message: 'Balance added successfully' };
  }

  async deductBalance(userId: string, amount: number, reference: string, description?: string, deductFromTotal: boolean = false) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    // Validar balance disponible usando cálculo dinámico (como en inversiones y metas)
    const availableBalance = await this.getAvailableBalance(userId);
    const roundedAvailable = Math.round(availableBalance.availableBalance * 100) / 100;
    const roundedAmount = Math.round(amount * 100) / 100;
    if (roundedAvailable < roundedAmount) {
      throw new Error(
        `Saldo insuficiente. Disponible: $${availableBalance.availableBalance.toFixed(2)}, Solicitado: $${amount.toFixed(2)}`
      );
    }

    // Obtener balance estático para actualizar el campo en app_users
    const currentBalance = await this.getUserBalance(userId);
    const newBalance = currentBalance.available_balance - amount;
    const newTotal = deductFromTotal
      ? (currentBalance.total_balance ?? currentBalance.available_balance) - amount
      : (currentBalance.total_balance ?? currentBalance.available_balance);


    // Usar admin client para operaciones de escritura (como en applyDepositToUser)
    const adminClient = this.supabaseService.getAdminClient();
    const client = adminClient ?? this.supabaseService.getClient();
    
    
    if (!client) {
      throw new Error('No Supabase client available');
    }

    // Actualizar balance (total solo baja en transferencias y pagos, no en inversiones)
    const { error: updateError, data: updateData } = await client
      .from('app_users')
      .update({
        available_balance: newBalance,
        total_balance: newTotal,
        last_balance_update: new Date().toISOString()
      })
      .eq('id', userId)
      .select('available_balance');

    if (updateError) {
      console.error('Error updating balance in app_users:', updateError);
      throw updateError;
    }


    // Registrar transacción de balance
    const { error: transactionError, data: transactionData } = await client
      .from('balance_transactions')
      .insert({
        user_id: userId,
        type: 'withdrawal',
        amount: -amount,
        balance_before: currentBalance.available_balance,
        balance_after: newBalance,
        reference: reference,
        description: description || 'Deducción de balance'
      })
      .select('id');

    if (transactionError) {
      console.error('Error inserting balance_transaction:', {
        error: transactionError,
        code: transactionError.code,
        message: transactionError.message,
        details: transactionError.details,
        hint: transactionError.hint,
        userId,
        reference,
      });
      // No lanzar error aquí para no afectar la deducción del balance, pero loguearlo
    } else {
    }

    return { message: 'Balance deducted successfully' };
  }

  async getBalanceHistory(userId: string, limit: number = 50) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    const { data, error } = await this.supabaseService.getClient()
      .from('balance_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  /**
   * Une cálculo por transacciones/inversiones con saldos persistidos post-migración:
   * - Si hay total_balance en app_users, se respeta como fuente del "dinero total".
   * - Saldo disponible se alinea con la identidad de producto: total = disponible + metas + principal activo.
   */
  private async buildBalancePayload(userId: string): Promise<{
    availableBalance: number;
    totalBalance: number;
    breakdown: Record<string, unknown>;
  }> {
    const calculations = await this.calculateBalances(userId);
    const persisted = await this.getUserBalance(userId).catch(() => null);
    const persistedTotal = this.toFiniteNumber(persisted?.total_balance);

    if (persistedTotal === null) {
      return {
        availableBalance: calculations.availableBalance,
        totalBalance: calculations.totalBalance,
        breakdown: {
          ...calculations.breakdown,
          source: 'calculated_formula',
        },
      };
    }

    const { goalsTotal, activeInvestmentsPrincipal } = calculations.breakdown;
    const totalBalance = persistedTotal;
    const availableBalance = Math.max(
      0,
      totalBalance - goalsTotal - activeInvestmentsPrincipal,
    );

    return {
      availableBalance,
      totalBalance,
      breakdown: {
        ...calculations.breakdown,
        source: 'hybrid_persisted_total',
      },
    };
  }

  async getAvailableBalance(userId: string) {
    try {
      const payload = await this.buildBalancePayload(userId);

      return {
        userId,
        availableBalance: payload.availableBalance,
        breakdown: payload.breakdown,
      };
    } catch (error) {
      console.error('Error calculating available balance:', error);
      throw new Error(`Error al calcular el saldo disponible: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  async getTotalBalance(userId: string) {
    try {
      const payload = await this.buildBalancePayload(userId);

      return {
        userId,
        totalBalance: payload.totalBalance,
        availableBalance: payload.availableBalance,
        breakdown: payload.breakdown,
      };
    } catch (error) {
      console.error('Error calculating total balance:', error);
      throw new Error(`Error al calcular el dinero total: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  private async calculateTotalBalance(userId: string): Promise<number> {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    const { data, error } = await this.supabaseService.getClient()
      .rpc('calculate_total_balance', { user_id_param: userId });

    if (error) throw error;
    return data;
  }

  private async calculateBalances(userId: string) {
    try {
      const [transactions, investments, goals, insuranceContracts] = await Promise.all([
        this.supabaseService.getTransactions(userId, undefined).catch(err => {
          console.error('Error fetching transactions:', err);
          return [];
        }),
        this.supabaseService.getInvestments(userId).catch(err => {
          console.error('Error fetching investments:', err);
          return [];
        }),
        this.supabaseService.getGoals(userId).catch(err => {
          console.error('Error fetching goals:', err);
          return [];
        }),
        this.getActiveInsuranceContracts(userId).catch(err => {
          console.error('Error fetching insurance contracts:', err);
          return [];
        }),
      ]);

    const sumByType = (type: string) =>
      (transactions || [])
        .filter(tx => tx.type === type)
        .reduce((sum, tx) => sum + Number(tx.amount ?? 0), 0);

    const deposits = sumByType('deposit');
    const payments = sumByType('payment');
    const internalTransfers = sumByType('internal_transfer');
    const externalTransfers = sumByType('external_transfer');

    const normalizeRate = (rawRate: unknown): number => {
      const rate = Number(rawRate ?? 0);
      if (!Number.isFinite(rate) || rate <= 0) return 0;
      // Algunas migraciones guardaron porcentaje (10.5), otras decimal (0.105)
      return rate >= 1 ? rate / 100 : rate;
    };

    const now = Date.now();
    const resolveInvestmentStatus = (inv: any): 'active' | 'matured' | 'cancelled' =>
      resolveInvestmentLifecycle(inv, now);

    const activeInvestments = (investments || []).filter(inv => {
      const status = resolveInvestmentStatus(inv);
      // Domiciliaciones son planes periódicos y no deben contarse como principal invertido
      return status === 'active' && !isInvestmentDomiciliation(inv);
    });
    const maturedInvestments = (investments || []).filter(inv => {
      const status = resolveInvestmentStatus(inv);
      return status === 'matured' && !isInvestmentDomiciliation(inv);
    });

    const activeInvestmentsPrincipal = activeInvestments.reduce(
      (sum, inv) => sum + Number(inv.amount ?? 0),
      0,
    );

    const maturedInvestmentsPrincipal = maturedInvestments.reduce(
      (sum, inv) => sum + Number(inv.amount ?? 0),
      0,
    );

    const maturedInvestmentsTotal = maturedInvestments.reduce((sum, inv) => {
      const principal = Number(inv.amount ?? 0);
      const interestRate = normalizeRate(inv.interestRate);
      const termMonths = Number(inv.term ?? 0);
      // Interés compuesto mensual: principal × ((1 + tasa/12)^meses - 1)
      const earnings = principal * (Math.pow(1 + interestRate / 12, termMonths) - 1);
      return sum + principal + earnings;
    }, 0);

    const goalsTotal = (goals || []).reduce(
      (sum, goal) => sum + Number(goal.progress ?? 0),
      0,
    );

    // Calcular total de pagos de seguros (activos y cancelados)
    // Al cancelar un seguro NO se reembolsa, por lo que seguimos restando del balance
    // Para seguros mensuales: considerar el monthly_premium (116)
    // Para seguros anuales: considerar el last_payment_amount si existe (ya pagado), sino usar monthly_premium (1160)
    const insurancePaymentsTotal = (insuranceContracts || []).reduce((sum, contract) => {
      // Solo considerar contratos que tienen un pago realizado (activos o cancelados)
      // Si está cancelado y no tiene last_payment_amount, usar monthly_premium (ya fue pagado)
      const premium = Number(contract.monthly_premium || 0);
      // Si es anual y tiene last_payment_amount, usar ese (ya pagado), sino usar monthly_premium (que es 1160 para anuales)
      const paymentAmount = contract.payment_frequency === 'yearly' && contract.last_payment_amount
        ? Number(contract.last_payment_amount || 0)
        : premium;
      return sum + paymentAmount;
    }, 0);

    const availableBalance =
      deposits -
      payments -
      internalTransfers -
      externalTransfers -
      activeInvestmentsPrincipal +
      maturedInvestmentsTotal -
      goalsTotal -
      insurancePaymentsTotal;

    const totalBalance =
      availableBalance +
      goalsTotal +
      activeInvestmentsPrincipal;

      return {
        availableBalance,
        totalBalance,
        maturedInvestmentsPrincipal,
        breakdown: {
          deposits,
          payments,
          internalTransfers,
          externalTransfers,
          activeInvestmentsPrincipal,
          maturedInvestmentsPrincipal,
          maturedInvestmentsTotal,
          goalsTotal,
          insurancePaymentsTotal,
        },
      };
    } catch (error) {
      console.error('Error calculating balances:', error);
      throw error;
    }
  }

  /**
   * Obtiene los contratos de seguros de un usuario (activos y cancelados)
   * Solo considera contratos donde el usuario es el titular (user_id)
   * Incluye cancelados porque el dinero pagado no se reembolsa
   */
  private async getActiveInsuranceContracts(userId: string): Promise<any[]> {
    const client = this.supabaseService.getAdminClient() ?? this.supabaseService.getClient();
    if (!client) {
      return [];
    }

    try {
      // Incluir activos y cancelados, porque al cancelar no se reembolsa
      const { data, error } = await client
        .from('insurance_contracts')
        .select('id, user_id, monthly_premium, payment_frequency, last_payment_amount, status')
        .eq('user_id', userId)
        .in('status', ['active', 'cancelled']);

      if (error) {
        console.error('Error fetching insurance contracts:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getActiveInsuranceContracts:', error);
      return [];
    }
  }
}
