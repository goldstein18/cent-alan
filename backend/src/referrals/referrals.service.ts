import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { BalanceService } from '../balance/balance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseService } from '../supabase/supabase.service';

/** Bonus acreditado al referidor cuando el invitado alcanza el umbral */
const REFERRAL_REWARD_AMOUNT = 50;

/** Monto mínimo acumulado en pagos que debe alcanzar el invitado */
const REFERRAL_PAYMENT_THRESHOLD = 1000;

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private supabaseService: SupabaseService,
    private balanceService: BalanceService,
    private notificationsService: NotificationsService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Código de referido
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Genera un código único de 8 caracteres a partir del ID del usuario.
   * Determinístico: siempre produce el mismo código para el mismo ID.
   */
  private generateCodeFromId(userId: string): string {
    return userId.replace(/-/g, '').substring(0, 8).toUpperCase();
  }

  /**
   * Devuelve el código de referido del usuario. Si aún no tiene uno
   * asignado lo genera y lo persiste en referral_info.code.
   */
  async getOrCreateReferralCode(userId: string): Promise<string> {
    const supabase = this.supabaseService.getAdminClient();
    if (!supabase) throw new Error('DB no disponible');

    const { data: user, error } = await supabase
      .from('app_users')
      .select('id, referral_info')
      .eq('id', userId)
      .single();

    if (error || !user) throw new NotFoundException('Usuario no encontrado');

    const existingCode = user.referral_info?.code;
    if (existingCode) return existingCode;

    // Generar y guardar
    const code = this.generateCodeFromId(userId);
    await supabase
      .from('app_users')
      .update({
        referral_info: {
          ...(user.referral_info ?? {}),
          code,
          total_referrals: user.referral_info?.total_referrals ?? 0,
          commission_earned: user.referral_info?.commission_earned ?? 0,
        },
      })
      .eq('id', userId);

    this.logger.log(`Código de referido generado para ${userId}: ${code}`);
    return code;
  }

  /**
   * Busca al usuario dueño del código de referido dado.
   * Retorna null si no existe.
   */
  async findReferrerByCode(code: string): Promise<{ id: string; firstName: string } | null> {
    const supabase = this.supabaseService.getAdminClient();
    if (!supabase) return null;

    const normalizedCode = code.trim().toUpperCase();

    const { data, error } = await supabase
      .from('app_users')
      .select('id, first_name')
      .filter('referral_info->>code', 'eq', normalizedCode)
      .limit(1);

    if (error || !data || data.length === 0) return null;
    return { id: data[0].id, firstName: data[0].first_name };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Alta de un referido (llamado desde auth.service signup)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Registra la relación invitador → invitado cuando un nuevo usuario se
   * registra usando un código de referido.
   * No lanza error si el código es inválido — solo lo ignora con un warning.
   */
  async processSignupReferral(newUserId: string, referralCode: string): Promise<void> {
    if (!referralCode) return;

    try {
      const supabase = this.supabaseService.getAdminClient();
      if (!supabase) return;

      const referrer = await this.findReferrerByCode(referralCode);
      if (!referrer) {
        this.logger.warn(`Código de referido inválido en signup: "${referralCode}" — ignorado`);
        return;
      }

      if (referrer.id === newUserId) {
        this.logger.warn(`Usuario ${newUserId} intentó usar su propio código — ignorado`);
        return;
      }

      // Verificar que no exista ya un registro para este invitado (UNIQUE referred_id)
      const { data: existing } = await supabase
        .from('referrals')
        .select('id')
        .eq('referred_id', newUserId)
        .limit(1);

      if (existing && existing.length > 0) {
        this.logger.warn(`El usuario ${newUserId} ya tiene un referidor registrado — ignorado`);
        return;
      }

      await supabase.from('referrals').insert({
        referrer_id: referrer.id,
        referred_id: newUserId,
        status: 'pending',
        reward_amount: REFERRAL_REWARD_AMOUNT,
      });

      // Persistir el código usado en referred_by para auditoría
      await supabase
        .from('app_users')
        .update({ referred_by: referralCode })
        .eq('id', newUserId);

      this.logger.log(`Referido registrado: ${referrer.id} invitó a ${newUserId}`);
    } catch (err) {
      // No bloquear el signup por un error en referidos
      this.logger.error(`Error procesando referido en signup: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Verificación de umbral (llamado después de cada pago)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Verifica si el usuario que acaba de pagar es un invitado, y si su
   * total acumulado de pagos alcanzó los $1,000. Si es así, acredita
   * $50 al referidor (una sola vez).
   */
  async checkAndRewardReferrer(payingUserId: string): Promise<void> {
    try {
      const supabase = this.supabaseService.getAdminClient();
      if (!supabase) return;

      // ¿Este usuario tiene un referidor con recompensa pendiente?
      const { data: referrals, error } = await supabase
        .from('referrals')
        .select('id, referrer_id, status')
        .eq('referred_id', payingUserId)
        .eq('status', 'pending')
        .limit(1);

      if (error || !referrals || referrals.length === 0) return;

      const referral = referrals[0];

      // Sumar todos los pagos completados del invitado
      // Abonos en punto de ahorro y abonos por transferencia recibida
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount')
        .eq('user_id', payingUserId)
        .eq('type', 'deposit')
        .eq('status', 'completed');

      const totalPayments = (transactions ?? []).reduce(
        (sum, tx) => sum + Number(tx.amount ?? 0),
        0,
      );

      this.logger.log(
        `[Referral] ${payingUserId} total pagos: $${totalPayments} / umbral: $${REFERRAL_PAYMENT_THRESHOLD}`,
      );

      if (totalPayments < REFERRAL_PAYMENT_THRESHOLD) return;

      // ── Umbral alcanzado: acreditar recompensa ─────────────────────────────
      // Marcar como recompensado PRIMERO para prevenir doble acreditación
      // en caso de llamadas concurrentes (el .eq('status','pending') actúa como guard)
      const { error: updateError, data: updatedRows } = await supabase
        .from('referrals')
        .update({
          status: 'rewarded',
          reward_paid_at: new Date().toISOString(),
        })
        .eq('id', referral.id)
        .eq('status', 'pending')
        .select('id');

      if (updateError || !updatedRows || updatedRows.length === 0) {
        this.logger.warn(
          `Referral ${referral.id} ya fue procesado por otro worker — omitido`,
        );
        return;
      }

      // Acreditar saldo al referidor
      const reference = `REFERRAL-${referral.id}`;
      await this.balanceService.addBalance(
        referral.referrer_id,
        REFERRAL_REWARD_AMOUNT,
        reference,
        'Recompensa por referido',
      );

      // Actualizar contadores en referral_info del referidor
      await this.incrementReferrerStats(referral.referrer_id, REFERRAL_REWARD_AMOUNT);

      // Notificar al referidor
      this.notificationsService.notifyReferralReward(referral.referrer_id);

      this.logger.log(
        `[Referral] ✅ $${REFERRAL_REWARD_AMOUNT} acreditados a ${referral.referrer_id} por referido ${payingUserId}`,
      );
    } catch (err) {
      // No bloquear el pago por un error en referidos
      this.logger.error(`Error en checkAndRewardReferrer: ${err.message}`);
    }
  }

  /**
   * Incrementa total_referrals y commission_earned en el JSONB del referidor.
   */
  private async incrementReferrerStats(referrerId: string, amount: number): Promise<void> {
    try {
      const supabase = this.supabaseService.getAdminClient();
      if (!supabase) return;

      const { data: user } = await supabase
        .from('app_users')
        .select('referral_info')
        .eq('id', referrerId)
        .single();

      if (!user) return;

      const current = user.referral_info ?? {};
      await supabase
        .from('app_users')
        .update({
          referral_info: {
            ...current,
            total_referrals: (current.total_referrals ?? 0) + 1,
            commission_earned: (current.commission_earned ?? 0) + amount,
          },
        })
        .eq('id', referrerId);
    } catch (err) {
      this.logger.error(`Error actualizando stats de referidor: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Endpoints públicos
  // ─────────────────────────────────────────────────────────────────────────

  /** Resumen de referidos propios (para la pantalla de la app) */
  async getReferrals(userId: string) {
    const supabase = this.supabaseService.getAdminClient();
    if (!supabase) throw new Error('DB no disponible');

    const code = await this.getOrCreateReferralCode(userId);

    const { data: referrals } = await supabase
      .from('referrals')
      .select(`
        id,
        status,
        reward_amount,
        reward_paid_at,
        created_at,
        referred:referred_id (first_name, last_name, phone_number)
      `)
      .eq('referrer_id', userId)
      .order('created_at', { ascending: false });

    const list = (referrals ?? []).map((r: any) => ({
      id: r.id,
      name: `${r.referred?.first_name ?? ''} ${r.referred?.last_name ?? ''}`.trim(),
      phone: r.referred?.phone_number ?? '',
      status: r.status,
      rewardAmount: r.reward_amount,
      rewardPaidAt: r.reward_paid_at,
      joinedAt: r.created_at,
    }));

    const totalEarned = list
      .filter(r => r.status === 'rewarded')
      .reduce((sum, r) => sum + (r.rewardAmount ?? 0), 0);

    return {
      referralCode: code,
      referralLink: `https://example.com/registro?ref=${code}`,
      stats: {
        totalReferrals: list.length,
        totalRewarded: list.filter(r => r.status === 'rewarded').length,
        totalPending: list.filter(r => r.status === 'pending').length,
        totalEarned,
      },
      referrals: list,
    };
  }

  /** Comisiones ganadas */
  async getCommissions(userId: string) {
    const result = await this.getReferrals(userId);
    return {
      totalCommissions: result.stats.totalEarned,
      totalReferrals: result.stats.totalReferrals,
    };
  }

  /** Valida un código antes del signup */
  async validateReferralCode(referralCode: string) {
    if (!referralCode) return { isValid: false };
    const referrer = await this.findReferrerByCode(referralCode);
    if (!referrer) return { isValid: false };
    return {
      isValid: true,
      referrerName: referrer.firstName,
    };
  }

  /** Obtener solo el código propio */
  async getMyCode(userId: string) {
    const code = await this.getOrCreateReferralCode(userId);
    return {
      code,
      link: `https://example.com/registro?ref=${code}`,
    };
  }
}
