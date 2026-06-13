import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SupabaseService } from '../supabase/supabase.service';

/** Expo experience for push notifications */
const CENTAPP_SLUG = 'demo-finance-app';
const EXPO_PROJECT_ID = process.env.EXPO_PROJECT_ID || '';
const LEGACY_EXPERIENCE_KEY = process.env.EXPO_LEGACY_EXPERIENCE_KEY || '';

interface ExpoPushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
  priority?: 'default' | 'normal' | 'high';
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  constructor(private readonly supabaseService: SupabaseService) {}

  async onModuleInit(): Promise<void> {
    await this.purgeLegacyPushTokens();
  }

  // ─────────────────────────────────────────────────────
  // Token Registration
  // ─────────────────────────────────────────────────────

  async registerToken(userId: string, token: string, platform?: string): Promise<void> {
    if (!token?.startsWith('ExponentPushToken[')) {
      this.logger.warn(`registerToken: invalid token format for user ${userId}: ${token?.slice(0, 30)}`);
      return;
    }
    const client = this.supabaseService.getAdminClient();
    const now = new Date().toISOString();

    await client
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .or(`app_slug.is.null,app_slug.neq.${CENTAPP_SLUG}`);

    const { error } = await client.from('push_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: platform || null,
        app_slug: CENTAPP_SLUG,
        updated_at: now,
      },
      { onConflict: 'user_id,token' },
    );
    if (error) {
      this.logger.error(`registerToken failed for user ${userId}: ${error.message}`);
      return;
    }
    this.logger.log(`Registered push token for user ${userId} (${platform}, ${CENTAPP_SLUG})`);
  }

  /** Elimina tokens de apps legacy u otros slugs */
  private async purgeLegacyPushTokens(): Promise<void> {
    const client = this.supabaseService.getAdminClient();
    const { data, error } = await client
      .from('push_tokens')
      .delete()
      .or(`app_slug.is.null,app_slug.neq.${CENTAPP_SLUG}`)
      .select('id');

    if (error) {
      if (error.message?.includes('app_slug')) {
        this.logger.warn(
          'purgeLegacyPushTokens: columna app_slug ausente — configura la columna app_slug en push_tokens',
        );
      } else {
        this.logger.error(`purgeLegacyPushTokens failed: ${error.message}`);
      }
      return;
    }
    const removed = data?.length ?? 0;
    if (removed > 0) {
      this.logger.log(`Removed ${removed} push token(s) not belonging to ${CENTAPP_SLUG}`);
    }
  }

  private async removePushTokens(tokens: string[]): Promise<void> {
    if (!tokens.length) return;
    const client = this.supabaseService.getAdminClient();
    const { error } = await client.from('push_tokens').delete().in('token', tokens);
    if (error) {
      this.logger.error(`removePushTokens failed: ${error.message}`);
    }
  }

  async removeToken(userId: string, token: string): Promise<void> {
    const client = this.supabaseService.getAdminClient();
    await client.from('push_tokens').delete().eq('user_id', userId).eq('token', token);
  }

  async getTokensForUser(userId: string): Promise<string[]> {
    const client = this.supabaseService.getAdminClient();
    const { data, error } = await client
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId)
      .eq('app_slug', CENTAPP_SLUG);
    if (error) {
      this.logger.error(`getTokensForUser(${userId}) failed: ${error.message}`);
      return [];
    }
    return (data || []).map((row: any) => row.token);
  }

  // ─────────────────────────────────────────────────────
  // Core Send
  // ─────────────────────────────────────────────────────

  async sendToUser(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, any>,
    channelId = 'default',
  ): Promise<void> {
    try {
      const tokens = await this.getTokensForUser(userId);
      this.logger.log(`sendToUser(${userId}): found ${tokens.length} token(s)`);
      if (!tokens.length) return;
      await this.sendPushMessages(
        tokens.map(to => ({ to, title, body, data: data || {}, sound: 'default', channelId })),
      );
    } catch (err) {
      this.logger.error(`sendToUser(${userId}) failed: ${err.message}`);
    }
  }

  async sendToMultipleUsers(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    if (!userIds.length) return;
    const client = this.supabaseService.getAdminClient();
    const { data: rows } = await client
      .from('push_tokens')
      .select('token')
      .in('user_id', userIds)
      .eq('app_slug', CENTAPP_SLUG);
    if (!rows?.length) return;
    const tokens = rows.map((r: any) => r.token);
    const messages: ExpoPushMessage[] = tokens.map(to => ({
      to,
      title,
      body,
      data: data || {},
      sound: 'default',
    }));
    await this.sendPushMessages(messages);
  }

  private async sendPushMessages(
    messages: ExpoPushMessage[],
    options?: { allowExperienceRetry?: boolean },
  ): Promise<void> {
    if (!messages.length) return;
    const chunks: ExpoPushMessage[][] = [];
    for (let i = 0; i < messages.length; i += 100) {
      chunks.push(messages.slice(i, i + 100));
    }
    for (const chunk of chunks) {
      try {
        const res = await fetch(this.EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
            'expo-project-id': EXPO_PROJECT_ID,
          },
          body: JSON.stringify(chunk),
        });
        const text = await res.text();
        if (!res.ok) {
          await this.handleExpoPushHttpError(res.status, text, chunk, options?.allowExperienceRetry !== false);
          continue;
        }
        await this.handleExpoPushSuccess(text, chunk);
      } catch (err) {
        this.logger.error(`Expo push fetch failed: ${err.message}`);
      }
    }
  }

  private extractTokenFromMessage(message: ExpoPushMessage): string | null {
    const to = message.to;
    return typeof to === 'string' ? to : null;
  }

  private async handleExpoPushSuccess(bodyText: string, chunk: ExpoPushMessage[]): Promise<void> {
    let parsed: { data?: Array<{ status?: string; message?: string; details?: { error?: string } }> };
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      this.logger.log(`Sent ${chunk.length} push notification(s)`);
      return;
    }

    const tokensToRemove: string[] = [];
    const tickets = parsed.data ?? [];
    let okCount = 0;

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket?.status === 'ok') {
        okCount++;
        continue;
      }
      const token = this.extractTokenFromMessage(chunk[i]);
      if (token) tokensToRemove.push(token);
    }

    if (tokensToRemove.length) {
      await this.removePushTokens(tokensToRemove);
      this.logger.warn(`Removed ${tokensToRemove.length} invalid push token(s) after Expo response`);
    }
    if (okCount > 0) {
      this.logger.log(`Sent ${okCount} push notification(s) (${CENTAPP_SLUG})`);
    }
  }

  private async handleExpoPushHttpError(
    status: number,
    bodyText: string,
    chunk: ExpoPushMessage[],
    allowExperienceRetry: boolean,
  ): Promise<void> {
    this.logger.error(`Expo push error ${status}: ${bodyText}`);

    let parsed: {
      errors?: Array<{
        code?: string;
        details?: Record<string, string[]>;
      }>;
    };
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      return;
    }

    const err = parsed.errors?.[0];
    if (err?.code !== 'PUSH_TOO_MANY_EXPERIENCE_IDS') return;

    const legacyTokens = err.details?.[LEGACY_EXPERIENCE_KEY] ?? [];
    if (legacyTokens.length) {
      await this.removePushTokens(legacyTokens);
      this.logger.warn(
        `Removed ${legacyTokens.length} token(s) from legacy experience ${LEGACY_EXPERIENCE_KEY}`,
      );
    }

    const appTokens = chunk
      .map(m => this.extractTokenFromMessage(m))
      .filter((t): t is string => !!t && !legacyTokens.includes(t));

    if (allowExperienceRetry && appTokens.length) {
      const retryMessages = chunk.filter(m => {
        const t = this.extractTokenFromMessage(m);
        return t && appTokens.includes(t);
      });
      if (retryMessages.length) {
        this.logger.log(`Retrying ${retryMessages.length} push(es) for ${CENTAPP_SLUG} only`);
        await this.sendPushMessages(retryMessages, { allowExperienceRetry: false });
      }
    }
  }

  // ─────────────────────────────────────────────────────
  // Event-triggered notification helpers (called from other services)
  // ─────────────────────────────────────────────────────

  /** 1. Depósito/abono exitoso */
  notifyDeposit(userId: string, monto: number): void {
    const formatted = monto.toLocaleString('es-MX', { minimumFractionDigits: 2 });
    this.sendToUser(
      userId,
      '✅ ¡Depósito recibido!',
      `¡Genial! Acabas de ahorrar $${formatted} MXN. ¡Sigue construyendo tu futuro!`,
      { screen: 'home' },
      'financial-alerts',
    ).catch(() => {});
  }

  /** 1b. Primer depósito (bienvenida) */
  notifyFirstDeposit(userId: string, monto: number): void {
    const formatted = monto.toLocaleString('es-MX', { minimumFractionDigits: 2 });
    this.sendToUser(
      userId,
      '👋 ¡Bienvenido a Cent!',
      `Tu primer depósito de $${formatted} MXN ya está guardado.`,
      { screen: 'home' },
    ).catch(() => {});
  }

  /** 2. Pago de servicio exitoso */
  notifyPaymentSuccess(userId: string, servicio: string, monto: number): void {
    const formatted = monto.toLocaleString('es-MX', { minimumFractionDigits: 2 });
    this.sendToUser(
      userId,
      '💸 Pago completado',
      `¡Listo! Pagaste ${servicio} por $${formatted} MXN sin problemas.`,
      { screen: 'payments' },
      'financial-alerts',
    ).catch(() => {});
  }

  /** 2b. Pago fallido por saldo insuficiente */
  notifyPaymentFailed(userId: string, servicio: string): void {
    this.sendToUser(
      userId,
      '🚫 Pago fallido',
      `Ups… No pudimos completar el pago de ${servicio}. Recarga y vuelve a intentar.`,
      { screen: 'home' },
      'financial-alerts',
    ).catch(() => {});
  }

  /** 3. Meta creada */
  notifyGoalCreated(userId: string, nombreMeta: string): void {
    this.sendToUser(
      userId,
      '🏁 ¡Meta lanzada!',
      `"${nombreMeta}" te espera. Haz tu primer abono y arranca con todo.`,
      { screen: 'goals' },
    ).catch(() => {});
  }

  /** 3b. Abono a meta */
  notifyGoalDeposit(userId: string, nombreMeta: string, monto: number, porcentaje: number): void {
    const formatted = monto.toLocaleString('es-MX', { minimumFractionDigits: 2 });
    this.sendToUser(
      userId,
      '📈 Abono a meta',
      `Sumaste $${formatted} MXN a "${nombreMeta}". ¡Vas al ${Math.round(porcentaje)}% de tu objetivo!`,
      { screen: 'goals' },
    ).catch(() => {});
  }

  /** 3c. Meta casi completa (≥90%) */
  notifyGoalAlmostComplete(userId: string, nombreMeta: string, restante: number): void {
    const formatted = restante.toLocaleString('es-MX', { minimumFractionDigits: 2 });
    this.sendToUser(
      userId,
      '🔥 ¡Casi lo logras!',
      `Solo faltan $${formatted} MXN para cerrar "${nombreMeta}".`,
      { screen: 'goals' },
    ).catch(() => {});
  }

  /** 4. Débito automático (domiciliación) procesado */
  notifyDomiciliacionSuccess(userId: string, monto: number): void {
    const formatted = monto.toLocaleString('es-MX', { minimumFractionDigits: 2 });
    this.sendToUser(
      userId,
      '✅ Débito automático',
      `Débito automático de $${formatted} MXN procesado con éxito. ¡Buen trabajo!`,
      { screen: 'investments' },
    ).catch(() => {});
  }

  /** 4b. Débito automático fallido */
  notifyDomiciliacionFailed(userId: string, monto: number): void {
    const formatted = monto.toLocaleString('es-MX', { minimumFractionDigits: 2 });
    this.sendToUser(
      userId,
      '❗ Débito fallido',
      `No fue posible debitar $${formatted} MXN. Recarga tu cuenta para seguir avanzando.`,
      { screen: 'home' },
      'financial-alerts',
    ).catch(() => {});
  }

  /** 5. Plan CiENTe+ activado */
  notifyInsuranceActivated(userId: string): void {
    this.sendToUser(
      userId,
      '🛡️ ¡Plan CiENTe+ activado!',
      'Protege lo que más te importa. Tu plan está activo.',
      { screen: 'insurance' },
    ).catch(() => {});
  }

  /** 6. Racha de ahorro */
  notifySavingStreak(userId: string, days: number): void {
    if (days === 2) {
      this.sendToUser(
        userId,
        '🔥 ¡2 días seguidos!',
        '¡Llevas 2 días seguidos ahorrando! No rompas la racha.',
        { screen: 'home' },
      ).catch(() => {});
    } else if (days >= 7) {
      this.sendToUser(
        userId,
        '🎉 ¡Felicidades!',
        `Son ${days} días de ahorro continuo. ¡Eres imparable!`,
        { screen: 'home' },
      ).catch(() => {});
    }
  }

  /** 11. Transferencia enviada */
  notifyTransferSent(userId: string, monto: number, destino: string): void {
    const formatted = monto.toLocaleString('es-MX', { minimumFractionDigits: 2 });
    this.sendToUser(
      userId,
      '📤 Transferencia enviada',
      `Transferencia de $${formatted} MXN enviada a ${destino}. ¡Listo!`,
      { screen: 'home' },
      'financial-alerts',
    ).catch(() => {});
  }

  /** 11b. Transferencia recibida */
  notifyTransferReceived(userId: string, monto: number, origen: string): void {
    const formatted = monto.toLocaleString('es-MX', { minimumFractionDigits: 2 });
    this.sendToUser(
      userId,
      '📥 Transferencia recibida',
      `¡Has recibido $${formatted} MXN de ${origen}! Revisa tu saldo.`,
      { screen: 'home' },
      'financial-alerts',
    ).catch(() => {});
  }

  /** 11c. Transferencia fallida */
  notifyTransferFailed(userId: string, monto: number, destino: string): void {
    const formatted = monto.toLocaleString('es-MX', { minimumFractionDigits: 2 });
    this.sendToUser(
      userId,
      '⚠️ Transferencia fallida',
      `No se pudo enviar $${formatted} MXN a ${destino}. Comprueba tus datos e inténtalo de nuevo.`,
      { screen: 'home' },
      'financial-alerts',
    ).catch(() => {});
  }

  /** 13. Inversión finalizada */
  notifyInvestmentMatured(userId: string, monto: number): void {
    const formatted = monto.toLocaleString('es-MX', { minimumFractionDigits: 2 });
    this.sendToUser(
      userId,
      '🔄 ¡Tu dinero creció!',
      `Tu inversión ha finalizado y tienes $${formatted} MXN (capital + rendimientos) disponibles. ¿Lo reinvertimos?`,
      { screen: 'investments' },
    ).catch(() => {});
  }

  /** 14. Nuevo inicio de sesión */
  notifyNewLogin(userId: string): void {
    this.sendToUser(
      userId,
      '🔐 Alerta de seguridad',
      'Detectamos un nuevo inicio de sesión en tu cuenta. Si no fuiste tú, contáctanos de inmediato.',
      { screen: 'profile' },
      'financial-alerts',
    ).catch(() => {});
  }

  /** 14b. PIN actualizado */
  notifyPinChanged(userId: string): void {
    this.sendToUser(
      userId,
      '✅ NIP actualizado',
      'Tu NIP de seguridad ha sido actualizado correctamente.',
      { screen: 'profile' },
    ).catch(() => {});
  }

  /** 17. Recompensa por referido */
  notifyReferralReward(userId: string): void {
    this.sendToUser(
      userId,
      '🤑 ¡Ka-ching!',
      'Recibiste una recompensa por referir a un amigo. Toca para ver tu saldo.',
      { screen: 'home' },
    ).catch(() => {});
  }

  /** Te enviaron una solicitud de división de gastos */
  notifySplitRequestReceived(userId: string, monto: number, fromName: string): void {
    this.sendToUser(
      userId,
      '💬 Nueva división de gastos',
      `Has recibido una petición de $${monto.toFixed(2)} MXN de ${fromName}. ¿Pagas ahora?`,
      { screen: 'split' },
    ).catch(() => {});
  }

  /** El participante pagó su parte (notifica al creador) */
  notifySplitRequestApproved(userId: string, monto: number): void {
    this.sendToUser(
      userId,
      '✅ División de gastos aprobada',
      `División de gastos de $${monto.toFixed(2)} MXN aprobad@. ¡Todo listo!`,
      { screen: 'split' },
    ).catch(() => {});
  }

  /** El participante no tenía saldo suficiente */
  notifySplitRequestFailed(userId: string, monto: number): void {
    this.sendToUser(
      userId,
      '🚫 Pago no procesado',
      `No pudimos procesar tu parte de $${monto.toFixed(2)} MXN. Recarga y vuelve a intentarlo.`,
      { screen: 'split' },
    ).catch(() => {});
  }

  /** Todos los participantes pagaron — se completa la solicitud */
  notifySplitRequestCompleted(userId: string, totalMonto: number): void {
    this.sendToUser(
      userId,
      '🎉 ¡Cobro completo!',
      `Recibiste $${totalMonto.toFixed(2)} MXN en total. Tu división de gastos está saldada.`,
      { screen: 'split' },
    ).catch(() => {});
  }

  // ─────────────────────────────────────────────────────
  // Scheduled / Cron Jobs
  // ─────────────────────────────────────────────────────

  /** Cada día a las 9am: notificaciones periódicas */
  @Cron('0 9 * * *', { timeZone: 'America/Mexico_City' })
  async runDailyNotifications(): Promise<void> {
    this.logger.log('Running daily notification jobs...');
    await Promise.allSettled([
      this.notifyUsersWithoutRecentDeposit(),
      this.notifyGoalsWithoutContribution(),
      this.notifyMaturedInvestments(),
      this.notifyDomiciliacionUpcoming(),
      this.notifyStreakAtRisk(),
      this.notifyIdleBalance(),
    ]);
  }

  /** Cada 1ro del mes a las 9am: recordatorio mensual */
  @Cron('0 9 1 * *', { timeZone: 'America/Mexico_City' })
  async runMonthlyReminder(): Promise<void> {
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const mes = meses[new Date().getMonth()];
    this.logger.log('Running monthly reminder...');
    await this.broadcastToAllActiveUsers(
      '📊 ¡Nuevo mes, nuevas metas!',
      `¿Listo para arrasar en ${mes}?`,
      { screen: 'home' },
    );
  }

  /** Cada lunes a las 10am: recordatorio semanal para quien no depositó */
  @Cron('0 10 * * 1', { timeZone: 'America/Mexico_City' })
  async runWeeklyDepositReminder(): Promise<void> {
    this.logger.log('Running weekly deposit reminder...');
    await this.notifyUsersWithoutWeeklyDeposit();
  }

  /** Días 15 y 30 a las 8am: ventana de nómina */
  @Cron('0 8 15,30 * *', { timeZone: 'America/Mexico_City' })
  async runNominaWindowDay1(): Promise<void> {
    this.logger.log('Running nómina window day 1 notification...');
    await this.notifyNominaWindow(1);
  }

  @Cron('0 8 16,31 * *', { timeZone: 'America/Mexico_City' })
  async runNominaWindowDay2(): Promise<void> {
    this.logger.log('Running nómina window day 2 notification...');
    await this.notifyNominaWindow(2);
  }

  @Cron('0 8 17,1 * *', { timeZone: 'America/Mexico_City' })
  async runNominaWindowDay3(): Promise<void> {
    this.logger.log('Running nómina window day 3 notification...');
    await this.notifyNominaWindow(3);
  }

  /** Trimestral (1ro de enero/abril/julio/octubre): recordatorio CiENTe+ */
  @Cron('0 10 1 1,4,7,10 *', { timeZone: 'America/Mexico_City' })
  async runQuarterlyInsuranceReminder(): Promise<void> {
    this.logger.log('Running quarterly CiENTe+ reminder...');
    await this.notifyInsuranceUsers();
  }

  // ─────────────────────────────────────────────────────
  // Cron Helpers (private DB queries + send)
  // ─────────────────────────────────────────────────────

  private async broadcastToAllActiveUsers(
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<void> {
    const client = this.supabaseService.getAdminClient();
    const { data: tokens } = await client
      .from('push_tokens')
      .select('token')
      .eq('app_slug', CENTAPP_SLUG);
    if (!tokens?.length) return;
    await this.sendPushMessages(
      tokens.map((r: any) => ({ to: r.token, title, body, data: data || {}, sound: 'default' })),
    );
  }

  /** Usuarios sin depósito en las últimas 24h */
  private async notifyUsersWithoutRecentDeposit(): Promise<void> {
    const client = this.supabaseService.getAdminClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Usuarios con token pero sin transacción de depósito en 24h
    const { data: tokens } = await client
      .from('push_tokens')
      .select('user_id, token')
      .eq('app_slug', CENTAPP_SLUG);
    if (!tokens?.length) return;

    const userIds = [...new Set(tokens.map((r: any) => r.user_id as string))];

    // Usuarios que SÍ depositaron en 24h
    const { data: activeDepositors } = await client
      .from('transactions')
      .select('user_id')
      .eq('type', 'deposit')
      .eq('status', 'completed')
      .gte('created_at', since)
      .in('user_id', userIds);

    const activeSet = new Set((activeDepositors || []).map((r: any) => r.user_id));
    const inactiveUserIds = userIds.filter(id => !activeSet.has(id));

    if (!inactiveUserIds.length) return;

    const inactiveTokens = tokens
      .filter((r: any) => inactiveUserIds.includes(r.user_id))
      .map((r: any) => r.token);

    await this.sendPushMessages(
      inactiveTokens.map(to => ({
        to,
        title: '💭 ¿Ya aportaste hoy?',
        body: 'Aún no vemos tu próximo abono. ¿Quieres aportar algo hoy?',
        data: { screen: 'home' },
        sound: 'default',
        channelId: 'reminders',
      })),
    );
    this.logger.log(`Sent 24h-no-deposit reminder to ${inactiveUserIds.length} users`);
  }

  /** Usuarios sin depósito en los últimos 7 días (semanal) */
  private async notifyUsersWithoutWeeklyDeposit(): Promise<void> {
    const client = this.supabaseService.getAdminClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: tokens } = await client
      .from('push_tokens')
      .select('user_id, token')
      .eq('app_slug', CENTAPP_SLUG);
    if (!tokens?.length) return;
    const userIds = [...new Set(tokens.map((r: any) => r.user_id as string))];

    const { data: activeDepositors } = await client
      .from('transactions')
      .select('user_id')
      .eq('type', 'deposit')
      .eq('status', 'completed')
      .gte('created_at', since)
      .in('user_id', userIds);

    const activeSet = new Set((activeDepositors || []).map((r: any) => r.user_id));
    const inactiveTokens = tokens
      .filter((r: any) => !activeSet.has(r.user_id))
      .map((r: any) => r.token);

    if (!inactiveTokens.length) return;
    await this.sendPushMessages(
      inactiveTokens.map(to => ({
        to,
        title: '💡 ¿Ya recargaste esta semana?',
        body: 'Esta semana: recarga tu cuenta y potencia tus ahorros.',
        data: { screen: 'home' },
        sound: 'default',
        channelId: 'reminders',
      })),
    );
  }

  /** Metas sin aportación en 48h o 7 días */
  private async notifyGoalsWithoutContribution(): Promise<void> {
    const client = this.supabaseService.getAdminClient();
    const cutoff48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const cutoff7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: goals } = await client
      .from('new_goals')
      .select('id, user_id, name, updated_at, created_at')
      .eq('status', 'active');

    if (!goals?.length) return;

    for (const goal of goals) {
      const lastActivity = goal.updated_at || goal.created_at;
      const daysSince = (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince >= 7) {
        this.sendToUser(
          goal.user_id,
          '💤 Meta en pausa',
          `Tu meta "${goal.name}" está en pausa. ¿Le das un nuevo impulso hoy?`,
          { screen: 'goals' },
          'reminders',
        ).catch(() => {});
      } else if (daysSince >= 2) {
        this.sendToUser(
          goal.user_id,
          '❓ ¿Ya aportaste?',
          `¿Ya aportaste a "${goal.name}" esta semana? Cada paso cuenta.`,
          { screen: 'goals' },
          'reminders',
        ).catch(() => {});
      }
    }
  }

  /** Inversiones vencidas (notificar al vencer y 24h después sin mover) */
  private async notifyMaturedInvestments(): Promise<void> {
    const client = this.supabaseService.getAdminClient();
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // Inversiones que vencieron HOY (maturity_date entre ayer y hoy)
    const { data: maturedToday } = await client
      .from('investments')
      .select('user_id, amount, maturity_date')
      .eq('status', 'active')
      .lte('maturity_date', now.toISOString())
      .gte('maturity_date', yesterday.toISOString());

    for (const inv of maturedToday || []) {
      this.notifyInvestmentMatured(inv.user_id, inv.amount);
    }

    // Inversiones que vencieron hace ~24h y siguen activas (usuario no las ha movido)
    const { data: maturedYesterday } = await client
      .from('investments')
      .select('user_id, amount')
      .eq('status', 'active')
      .lte('maturity_date', yesterday.toISOString())
      .gte('maturity_date', twoDaysAgo.toISOString());

    for (const inv of maturedYesterday || []) {
      const formatted = (inv.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });
      this.sendToUser(
        inv.user_id,
        '📉 Tienes dinero "dormido"',
        `Tu inversión venció ayer. Renueva el plazo hoy para seguir ganando interés compuesto.`,
        { screen: 'investments' },
        'financial-alerts',
      ).catch(() => {});
    }
  }

  /** Domiciliaciones con cargo en los próximos 3 días */
  private async notifyDomiciliacionUpcoming(): Promise<void> {
    const client = this.supabaseService.getAdminClient();
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: domiciliaciones } = await client
      .from('investments')
      .select('user_id, amount, next_charge_date')
      .eq('is_domiciliation', true)
      .eq('status', 'active')
      .lte('next_charge_date', in3Days)
      .gte('next_charge_date', tomorrow);

    for (const dom of domiciliaciones || []) {
      const formatted = (dom.amount || 0).toLocaleString('es-MX', { minimumFractionDigits: 2 });
      this.sendToUser(
        dom.user_id,
        '⌛ Débito próximo',
        `En 3 días se debitarán $${formatted} MXN. Asegúrate de tener fondos.`,
        { screen: 'investments' },
        'reminders',
      ).catch(() => {});
    }
  }

  /** Racha en riesgo: usuario con racha activa que no ha depositado hoy */
  private async notifyStreakAtRisk(): Promise<void> {
    const client = this.supabaseService.getAdminClient();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Usuarios con racha >= 2 días
    const { data: usersWithStreak } = await client
      .from('app_users')
      .select('id, streak_days')
      .gte('streak_days', 2);

    if (!usersWithStreak?.length) return;
    const userIds = usersWithStreak.map((u: any) => u.id);

    // Quiénes ya depositaron hoy
    const { data: todayDepositors } = await client
      .from('transactions')
      .select('user_id')
      .eq('type', 'deposit')
      .eq('status', 'completed')
      .gte('created_at', todayStart.toISOString())
      .in('user_id', userIds);

    const depositedSet = new Set((todayDepositors || []).map((r: any) => r.user_id));
    const atRiskUsers = usersWithStreak.filter((u: any) => !depositedSet.has(u.id));

    for (const user of atRiskUsers) {
      this.sendToUser(
        user.id,
        '⏳ Tu racha está en riesgo',
        '¿Abonas algo hoy para seguir con el impulso?',
        { screen: 'home' },
        'reminders',
      ).catch(() => {});
    }
  }

  /** Saldo ocioso > $5,000 sin inversión activa */
  private async notifyIdleBalance(): Promise<void> {
    const client = this.supabaseService.getAdminClient();
    const IDLE_THRESHOLD = 5000;

    const { data: users } = await client
      .from('app_users')
      .select('id, available_balance')
      .gte('available_balance', IDLE_THRESHOLD);

    if (!users?.length) return;

    for (const user of users) {
      const saldo = (user.available_balance || 0).toLocaleString('es-MX', {
        minimumFractionDigits: 2,
      });
      const sugerido = Math.floor(user.available_balance * 0.3).toLocaleString('es-MX');
      this.sendToUser(
        user.id,
        '🎯 Tienes saldo disponible',
        `Tienes $${saldo} MXN disponible. ¿Quieres crear una meta rápida con $${sugerido}?`,
        { screen: 'investments' },
        'reminders',
      ).catch(() => {});
    }
  }

  /** Ventana de nómina (días 15-17 y 30/31-1) */
  private async notifyNominaWindow(dayNumber: 1 | 2 | 3): Promise<void> {
    const messages: Record<number, { title: string; body: string }> = {
      1: {
        title: '🗓️ Periodo de nómina',
        body: 'Hoy comienza tu periodo de descuento de nómina. Aprovecha y haz tu abono para impulsar tu ahorro.',
      },
      2: {
        title: '🔔 Día de nómina',
        body: 'Hoy es tu día de descuento de nómina. No olvides abonar para no perder esta oportunidad.',
      },
      3: {
        title: '⏳ Último día de nómina',
        body: 'Hoy es tu último día de descuento de nómina. Haz tu abono antes de que termine esta ventana.',
      },
    };
    const { title, body } = messages[dayNumber];
    await this.broadcastToAllActiveUsers(title, body, { screen: 'home' });
  }

  /** Recordatorio trimestral CiENTe+ */
  private async notifyInsuranceUsers(): Promise<void> {
    const client = this.supabaseService.getAdminClient();

    const { data: contracts } = await client
      .from('insurance_contracts')
      .select('user_id')
      .eq('status', 'active');

    const userIds = [...new Set((contracts || []).map((c: any) => c.user_id))];
    if (!userIds.length) return;

    await this.sendToMultipleUsers(
      userIds,
      '🦷 ¿Ya fuiste al dentista?',
      'Recuerda que tu plan CiENTe+ incluye una limpieza dental GRATIS al año. ¡Agenda aquí!',
      { screen: 'insurance' },
    );
  }
}
