import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { BalanceService } from '../balance/balance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AcceptSplitRequestDto, CreateSplitRequestDto } from '../types/split-request';

@Injectable()
export class SplitRequestsService {
  constructor(
    private supabaseService: SupabaseService,
    private balanceService: BalanceService,
    private notificationsService: NotificationsService,
  ) {}

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

    const pinWithSalt = pin + (user.password_salt || '');
    const hashedPin = crypto.createHash('sha1').update(pinWithSalt).digest('hex');
    return hashedPin.toLowerCase() === user.pin.toLowerCase();
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return '52' + digits;
    }
    if (digits.length >= 12 && digits.startsWith('52')) {
      return digits;
    }
    return digits;
  }

  private buildPhoneVariants(phone: string): string[] {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return [];
    const variants = new Set<string>();
    const normalized = this.normalizePhone(phone);
    variants.add(normalized);
    if (normalized.length === 12 && normalized.startsWith('52')) {
      variants.add(normalized.slice(-10));
    } else if (normalized.length === 10) {
      variants.add('52' + normalized);
    }
    if (normalized.length >= 10) {
      const ten = normalized.slice(-10);
      variants.add('+52' + ten);
      variants.add('+521' + ten);
    }
    return Array.from(variants);
  }

  private async findUserByPhone(phone: string): Promise<{ id: string } | null> {
    const client = this.supabaseService.getAdminClient();
    if (!client) return null;

    const variants = this.buildPhoneVariants(phone);
    if (variants.length === 0) return null;

    const { data, error } = await client
      .from('app_users')
      .select('id')
      .in('phone_number', variants)
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return { id: data.id };
  }

  async getSentRequests(userId: string) {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      return [];
    }

    const { data: requests, error } = await client
      .from('split_requests')
      .select(`
        id,
        concepto,
        descripcion,
        total_amount,
        status,
        created_at,
        split_request_participants (
          id,
          user_id,
          name,
          phone_number,
          amount,
          status
        )
      `)
      .eq('creator_user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching sent split requests:', error);
      return [];
    }

    return (requests || []).map((r: any) => ({
      id: r.id,
      concepto: r.concepto,
      descripcion: r.descripcion,
      total: Number(r.total_amount || 0),
      estado: this.mapStatus(r.status),
      fecha: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '',
      participantes: (r.split_request_participants || []).map((p: any) => ({
        nombre: p.name,
        telefono: p.phone_number,
        monto: Number(p.amount || 0),
        estado: this.mapParticipantStatus(p.status),
      })),
    }));
  }

  async getReceivedRequests(userId: string) {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      return [];
    }

    const user = await this.supabaseService.getUser(userId);
    if (!user) return [];
    const phoneVariants = this.buildPhoneVariants(user.phone_number || '');

    let participants: any[] = [];

    const { data: byUserId } = await client
      .from('split_request_participants')
      .select('id, split_request_id, amount, status')
      .eq('user_id', userId)
      .eq('status', 'pending');
    if (byUserId) participants.push(...byUserId);

    if (phoneVariants.length > 0) {
      const { data: byPhone } = await client
        .from('split_request_participants')
        .select('id, split_request_id, amount, status')
        .in('phone_number', phoneVariants)
        .eq('status', 'pending');
      if (byPhone) {
        const seen = new Set(participants.map((p) => p.split_request_id));
        for (const p of byPhone) {
          if (!seen.has(p.split_request_id)) {
            seen.add(p.split_request_id);
            participants.push(p);
          }
        }
      }
    }

    if (participants.length === 0) return [];

    const uniqueRequestIds = [...new Set(participants.map((p) => p.split_request_id))];
    const { data: requests, error } = await client
      .from('split_requests')
      .select('id, concepto, descripcion, total_amount, status, created_at, creator_user_id')
      .in('id', uniqueRequestIds);

    if (error || !requests) return [];

    const creatorIds = [...new Set(requests.map((r: any) => r.creator_user_id))];
    const { data: creators } = await client
      .from('app_users')
      .select('id, first_name, last_name')
      .in('id', creatorIds);

    const creatorMap = new Map((creators || []).map((c: any) => [c.id, `${c.first_name || ''} ${c.last_name || ''}`.trim()]));

    const participantCountMap = new Map<string, number>();
    const { data: allParticipants } = await client
      .from('split_request_participants')
      .select('split_request_id')
      .in('split_request_id', uniqueRequestIds);
    for (const p of allParticipants || []) {
      participantCountMap.set(p.split_request_id, (participantCountMap.get(p.split_request_id) || 0) + 1);
    }

    return requests.map((r: any) => ({
      id: r.id,
      concepto: r.concepto,
      participantes: participantCountMap.get(r.id) || 0,
      total: Number(r.total_amount || 0),
      estado: 'Pendiente',
      fecha: r.created_at ? new Date(r.created_at).toISOString().split('T')[0] : '',
      de: creatorMap.get(r.creator_user_id) || 'Desconocido',
    }));
  }

  private mapStatus(status: string): string {
    switch (status) {
      case 'pending':
        return 'Enviada';
      case 'cancelled':
        return 'Cancelada';
      case 'completed':
        return 'Completada';
      default:
        return status;
    }
  }

  private mapParticipantStatus(status: string): string {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'accepted':
        return 'Aceptada';
      case 'rejected':
        return 'Rechazada';
      default:
        return status;
    }
  }

  async createSplitRequest(userId: string, dto: CreateSplitRequestDto, pin: string) {
    const isValidPin = await this.verifyPin(userId, pin);
    if (!isValidPin) {
      throw new UnauthorizedException('PIN incorrecto');
    }

    if (!dto.concepto || !dto.participantes || dto.participantes.length === 0) {
      throw new BadRequestException('Concepto y al menos un participante son requeridos');
    }

    const participants = dto.participantes.map((p) => ({
      nombre: (p.nombre || '').trim(),
      telefono: (p.telefono || '').replace(/\D/g, ''),
      monto: parseFloat(String(p.monto || 0)) || 0,
    }));

    if (participants.some((p) => !p.nombre || !p.telefono || p.monto <= 0)) {
      throw new BadRequestException('Todos los participantes deben tener nombre, teléfono y monto mayor a 0');
    }

    const client = this.supabaseService.getAdminClient();
    if (client) {
      const notRegistered: string[] = [];
      for (const p of participants) {
        const userByPhone = await this.findUserByPhone(p.telefono);
        if (!userByPhone) {
          notRegistered.push(p.telefono.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2 $3'));
        }
      }
      if (notRegistered.length > 0) {
        const formatted = notRegistered.map((n) => (n.length >= 10 ? n.slice(-10).replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3') : n));
        throw new BadRequestException(
          `Los siguientes números no están registrados en CENT: ${formatted.join(', ')}. Solo puedes invitar a usuarios que tengan cuenta en la app.`
        );
      }
    }

    const totalAmount = participants.reduce((sum, p) => sum + p.monto, 0);
    if (!client) {
      throw new Error('Supabase no configurado');
    }

    const { data: request, error: reqError } = await client
      .from('split_requests')
      .insert({
        creator_user_id: userId,
        concepto: dto.concepto,
        descripcion: dto.descripcion || null,
        total_amount: totalAmount,
        status: 'pending',
      })
      .select()
      .single();

    if (reqError) {
      console.error('Error creating split request:', reqError);
      throw new BadRequestException('No se pudo crear la solicitud');
    }

    for (const p of participants) {
      const userByPhone = await this.findUserByPhone(p.telefono);
      await client.from('split_request_participants').insert({
        split_request_id: request.id,
        user_id: userByPhone?.id || null,
        phone_number: this.normalizePhone(p.telefono),
        name: p.nombre,
        amount: p.monto,
        status: 'pending',
      });
    }

    // Notificar a cada participante que recibió una solicitud (fire-and-forget)
    const creator = await this.supabaseService.getUser(userId);
    const creatorName = creator
      ? `${creator.first_name || ''} ${creator.last_name || ''}`.trim() || 'Un usuario'
      : 'Un usuario';

    for (const p of participants) {
      const userByPhone = await this.findUserByPhone(p.telefono);
      if (userByPhone?.id) {
        this.notificationsService.notifySplitRequestReceived(userByPhone.id, p.monto, creatorName);
      }
    }

    return request;
  }

  async cancelSplitRequest(userId: string, requestId: string, pin: string) {
    const isValidPin = await this.verifyPin(userId, pin);
    if (!isValidPin) {
      throw new UnauthorizedException('PIN incorrecto');
    }

    const client = this.supabaseService.getAdminClient();
    if (!client) throw new BadRequestException('Supabase no configurado');

    const { data: existing, error: fetchError } = await client
      .from('split_requests')
      .select('id, creator_user_id')
      .eq('id', requestId)
      .single();

    if (fetchError || !existing) {
      throw new BadRequestException('Solicitud no encontrada');
    }
    if (existing.creator_user_id !== userId) {
      throw new UnauthorizedException('No tienes permiso para cancelar esta solicitud');
    }

    await client
      .from('split_requests')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('creator_user_id', userId);

    return { success: true, message: 'Solicitud cancelada' };
  }

  async acceptSplitRequest(userId: string, participantId: string, dto: AcceptSplitRequestDto) {
    const isValidPin = await this.verifyPin(userId, dto.pin);
    if (!isValidPin) {
      throw new UnauthorizedException('PIN incorrecto');
    }

    const client = this.supabaseService.getAdminClient();
    if (!client) throw new BadRequestException('Supabase no configurado');

    // Obtener datos del participante y la solicitud en una sola consulta
    const { data: participant, error: partError } = await client
      .from('split_request_participants')
      .select('id, split_request_id, user_id, phone_number, amount, status')
      .eq('id', participantId)
      .single();

    if (partError || !participant) {
      throw new BadRequestException('Participante no encontrado');
    }

    const user = await this.supabaseService.getUser(userId);
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const phoneVariants = this.buildPhoneVariants(user.phone_number || '');
    const isParticipant =
      participant.user_id === userId || phoneVariants.some((v) => v === participant.phone_number);

    if (!isParticipant) {
      throw new UnauthorizedException('No tienes permiso para aceptar esta solicitud');
    }
    if (participant.status !== 'pending') {
      throw new BadRequestException('Esta solicitud ya fue procesada');
    }

    // Obtener la solicitud para saber a quién acreditar
    const { data: splitRequest, error: reqError } = await client
      .from('split_requests')
      .select('id, creator_user_id, concepto, total_amount, status')
      .eq('id', participant.split_request_id)
      .single();

    if (reqError || !splitRequest) {
      throw new BadRequestException('Solicitud no encontrada');
    }
    if (splitRequest.status === 'cancelled') {
      throw new BadRequestException('Esta solicitud fue cancelada');
    }

    const amount = Number(participant.amount);
    const reference = `SPLIT-${participantId}-${Date.now()}`;

    // Verificar saldo suficiente del participante
    const available = await this.balanceService.getAvailableBalance(userId);
    if (available.availableBalance < amount) {
      // Notificar al participante que no tiene saldo
      this.notificationsService.notifySplitRequestFailed(userId, amount);
      throw new BadRequestException(
        `Saldo insuficiente. Disponible: $${available.availableBalance.toFixed(2)}, Requerido: $${amount.toFixed(2)}`
      );
    }

    // Deducir del participante (deductFromTotal=true: sale de su cuenta)
    await this.balanceService.deductBalance(
      userId,
      amount,
      reference,
      `División de gastos: ${splitRequest.concepto}`,
      true,
    );

    // Registrar transacción de salida para el participante (aparece en su estado de cuenta)
    // Wrapped in try-catch: never block the critical path (balance + notification)
    try {
      await this.supabaseService.createTransaction({
        user_id: userId,
        type: 'internal_transfer',
        amount: amount,
        description: `División de gastos: ${splitRequest.concepto}`,
        reference,
        status: 'completed',
      });
    } catch (txErr) {
      console.error('[acceptSplitRequest] Failed to record participant transaction:', txErr?.message);
    }

    // Acreditar al creador
    await this.balanceService.addBalance(
      splitRequest.creator_user_id,
      amount,
      reference,
      `Cobro de división de gastos: ${splitRequest.concepto}`,
    );

    // Registrar transacción de entrada para el creador (aparece en su estado de cuenta)
    try {
      await this.supabaseService.createTransaction({
        user_id: splitRequest.creator_user_id,
        type: 'deposit',
        amount: amount,
        description: `Cobro de división de gastos: ${splitRequest.concepto}`,
        reference,
        status: 'completed',
      });
    } catch (txErr) {
      console.error('[acceptSplitRequest] Failed to record creator transaction:', txErr?.message);
    }

    // Marcar participante como pagado
    await client
      .from('split_request_participants')
      .update({ status: 'accepted', user_id: userId, updated_at: new Date().toISOString() })
      .eq('id', participantId);

    // Notificar al creador que alguien pagó
    this.notificationsService.notifySplitRequestApproved(splitRequest.creator_user_id, amount);

    // Verificar si todos los participantes han pagado
    const { data: allParticipants } = await client
      .from('split_request_participants')
      .select('status')
      .eq('split_request_id', participant.split_request_id);

    const allPaid = (allParticipants || []).every((p) => p.status === 'accepted');
    if (allPaid) {
      // Marcar solicitud como completada
      await client
        .from('split_requests')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('id', participant.split_request_id);

      // Notificar al creador que el cobro está completo
      this.notificationsService.notifySplitRequestCompleted(
        splitRequest.creator_user_id,
        Number(splitRequest.total_amount),
      );
    }

    return { success: true, message: 'Pago realizado exitosamente' };
  }

  async rejectSplitRequest(userId: string, participantId: string) {
    const client = this.supabaseService.getAdminClient();
    if (!client) throw new BadRequestException('Supabase no configurado');

    const { data: participant, error } = await client
      .from('split_request_participants')
      .select('id, split_request_id, user_id, phone_number, amount, status')
      .eq('id', participantId)
      .single();

    if (error || !participant) {
      throw new BadRequestException('Participante no encontrado');
    }

    const user = await this.supabaseService.getUser(userId);
    if (!user) throw new UnauthorizedException('Usuario no encontrado');

    const phoneVariants = this.buildPhoneVariants(user.phone_number || '');
    const isParticipant =
      participant.user_id === userId || phoneVariants.some((v) => v === participant.phone_number);

    if (!isParticipant) {
      throw new UnauthorizedException('No tienes permiso para rechazar esta solicitud');
    }
    if (participant.status !== 'pending') {
      throw new BadRequestException('Esta solicitud ya fue procesada');
    }

    await client
      .from('split_request_participants')
      .update({ status: 'rejected', updated_at: new Date().toISOString() })
      .eq('id', participantId);

    // Notificar al creador que alguien rechazó
    const { data: splitRequest } = await client
      .from('split_requests')
      .select('creator_user_id, concepto, total_amount')
      .eq('id', participant.split_request_id)
      .single();

    if (splitRequest) {
      const amount = Number(participant.amount ?? splitRequest.total_amount ?? 0);
      this.notificationsService.notifySplitRequestFailed(splitRequest.creator_user_id, amount);
    }

    return { success: true, message: 'Solicitud rechazada' };
  }

  async getRequestDetail(userId: string, requestId: string) {
    const client = this.supabaseService.getAdminClient();
    if (!client) return null;

    const { data: request, error } = await client
      .from('split_requests')
      .select(`
        id,
        concepto,
        descripcion,
        total_amount,
        status,
        created_at,
        creator_user_id,
        split_request_participants (
          id,
          user_id,
          name,
          phone_number,
          amount,
          status
        )
      `)
      .eq('id', requestId)
      .single();

    if (error || !request) return null;

    const isCreator = request.creator_user_id === userId;
    const user = await this.supabaseService.getUser(userId);
    const phoneVariants = user ? this.buildPhoneVariants(user.phone_number || '') : [];
    const isParticipant = (request.split_request_participants || []).some(
      (p: any) => p.user_id === userId || phoneVariants.includes(p.phone_number),
    );

    if (!isCreator && !isParticipant) return null;

    const { data: creator } = await client
      .from('app_users')
      .select('first_name, last_name')
      .eq('id', request.creator_user_id)
      .single();

    return {
      id: request.id,
      concepto: request.concepto,
      descripcion: request.descripcion,
      total: Number(request.total_amount || 0),
      estado: this.mapStatus(request.status),
      fecha: request.created_at ? new Date(request.created_at).toISOString().split('T')[0] : '',
      de: creator ? `${creator.first_name || ''} ${creator.last_name || ''}`.trim() : 'Desconocido',
      participantes: (request.split_request_participants || []).map((p: any) => ({
        id: p.id,
        nombre: p.name,
        telefono: p.phone_number,
        monto: Number(p.amount || 0),
        estado: this.mapParticipantStatus(p.status),
      })),
      isCreator,
    };
  }

  async getParticipantIdForReceivedRequest(userId: string, requestId: string): Promise<string | null> {
    const client = this.supabaseService.getAdminClient();
    if (!client) return null;

    const { data: byUserId } = await client
      .from('split_request_participants')
      .select('id')
      .eq('split_request_id', requestId)
      .eq('user_id', userId)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();
    if (byUserId) return byUserId.id;

    const user = await this.supabaseService.getUser(userId);
    if (!user) return null;
    const phoneVariants = this.buildPhoneVariants(user.phone_number || '');
    if (phoneVariants.length === 0) return null;

    const { data: byPhone } = await client
      .from('split_request_participants')
      .select('id')
      .eq('split_request_id', requestId)
      .in('phone_number', phoneVariants)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();
    return byPhone?.id || null;
  }
}
