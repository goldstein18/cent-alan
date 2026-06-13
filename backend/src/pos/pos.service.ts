import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { BalanceService } from '../balance/balance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PaymentOtpService } from '../payments/payment-otp.service';
import { ReferralsService } from '../referrals/referrals.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class PosService {
  constructor(
    private supabaseService: SupabaseService,
    private balanceService: BalanceService,
    private paymentOtpService: PaymentOtpService,
    private notificationsService: NotificationsService,
    private referralsService: ReferralsService,
  ) {}

  // Autenticación POS (solo para usuarios POS)
  async loginPosUser(email: string, password: string) {
    // Normalizar email (trim y lowercase)
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedPassword = password?.trim();
    
    const adminClient = this.supabaseService.getAdminClient();
    
    if (!adminClient) {
      throw new BadRequestException('Supabase no configurado');
    }

    
    // Primero verificar si el usuario existe (sin filtrar por is_active)
    const { data: userExists, error: checkError } = await adminClient
      .from('pos_users')
      .select('id, email, is_active')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('[POS Login] Error verificando usuario:', checkError.message);
      throw new BadRequestException(`Error al buscar usuario: ${checkError.message}`);
    }

    // Si el usuario existe pero está inactivo, rechazar el login
    if (userExists && !userExists.is_active) {
      throw new BadRequestException('Usuario POS inactivo. Contacta al administrador.');
    }

    // Si no está en pos_users, intentar con admin_users (admins también pueden usar POS)
    if (!userExists) {
      const adminResult = await this.loginAdminUserInPOS(normalizedEmail, normalizedPassword);
      if (adminResult) {
        return adminResult;
      }
      throw new BadRequestException('Usuario POS no encontrado');
    }

    // Si llegamos aquí, el usuario existe y está activo, obtener datos completos
    const { data: user, error } = await adminClient
      .from('pos_users')
      .select(`
        *,
        branches!inner(name, alias, brands!inner(name, alias))
      `)
      .eq('email', normalizedEmail)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error('[POS Login] Error obteniendo datos completos:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      // Si hay un problema con la relación (branches/brands), dar mensaje específico
      if (error.message?.includes('branches') || error.message?.includes('brands')) {
        throw new BadRequestException('Error en la relación con sucursal o marca. Contacta al administrador.');
      }
      
      throw new BadRequestException(`Error al obtener datos del usuario: ${error.message}`);
    }

    if (!user) {
      throw new BadRequestException('Usuario POS no encontrado');
    }

    if (!normalizedPassword) {
      throw new BadRequestException('Contraseña incorrecta');
    }


    const isPasswordValid = await bcrypt.compare(normalizedPassword, user.password);
    if (!isPasswordValid) {
      throw new BadRequestException('Contraseña incorrecta');
    }

    // Actualizar último login
    await this.supabaseService.getAdminClient()
      .from('pos_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    // Remover password del objeto de respuesta
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // Login alternativo: admin_users también pueden entrar al POS
  private async loginAdminUserInPOS(email: string, password: string) {
    const adminClient = this.supabaseService.getAdminClient();

    const { data: adminUser, error } = await adminClient
      .from('admin_users')
      .select('id, email, name, role, is_active, password')
      .eq('email', email)
      .eq('is_active', true)
      .maybeSingle();

    if (error || !adminUser) return null;

    const isValid = await bcrypt.compare(password, adminUser.password);
    if (!isValid) return null;

    // Actualizar last_login
    await adminClient
      .from('admin_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', adminUser.id);

    const { password: _pw, ...safe } = adminUser as any;
    return {
      ...safe,
      full_name: safe.name,
      // Los admin no tienen sucursal fija — acceso global
      branch: null,
      source: 'admin_users',
    };
  }

  // Sistema de abonos (funcionalidad principal del POS)
  async createDeposit(depositData: {
    pos_user_id?: string;
    branch_id?: string;
    phone_number?: string;
    phone_confirmation?: string;
    amount?: number;
    amount_confirmation?: number;
    notes?: string;
    payload?: any;
    posUserId?: string;
    branchId?: string;
    posUserID?: string;
    branchID?: string;
    phoneNumber?: string;
    phoneConfirmation?: string;
    telefono?: string;
    telefono_confirmacion?: string;
    telefonoConfirmacion?: string;
    monto?: number | string;
    monto_confirmacion?: number | string;
    montoConfirmacion?: number | string;
    amountConfirmation?: number | string;
    observaciones?: string;
    nota?: string;
  }) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    const pickValue = <T>(...values: Array<T | undefined | null>): T | undefined => {
      for (const value of values) {
        if (value !== undefined && value !== null && value !== '') {
          return value as T;
        }
      }
      return undefined;
    };

    const payload = depositData.payload ?? {};

    const rawAmount = pickValue<number | string>(
      depositData.amount,
      depositData.amount_confirmation,
      depositData.amountConfirmation,
      depositData.monto,
      depositData.monto_confirmacion,
      depositData.montoConfirmacion,
      payload.amount,
      payload.amount_confirmation,
      payload.amountConfirmation,
      payload.monto,
      payload.monto_confirmacion,
      payload.montoConfirmacion
    );

    const rawAmountConfirmation = pickValue<number | string>(
      depositData.amount_confirmation,
      depositData.amountConfirmation,
      depositData.amount,
      depositData.monto_confirmacion,
      depositData.montoConfirmacion,
      depositData.monto,
      payload.amount_confirmation,
      payload.amountConfirmation,
      payload.amount,
      payload.monto_confirmacion,
      payload.montoConfirmacion,
      payload.monto
    );

    const normalizePhone = (value?: string) => {
      if (!value) {
        return undefined;
      }
      const digits = value.replace(/\D/g, '');
      return digits.length > 0 ? digits : undefined;
    };

    const rawPhone = pickValue<string>(
      depositData.phone_number,
      depositData.phoneNumber,
      depositData.phone_confirmation,
      depositData.phoneConfirmation,
      depositData.telefono,
      depositData.telefono_confirmacion,
      depositData.telefonoConfirmacion,
      payload.phone_number,
      payload.phoneNumber,
      payload.phone_confirmation,
      payload.phoneConfirmation,
      payload.telefono,
      payload.telefono_confirmacion,
      payload.telefonoConfirmacion
    );

    const rawPhoneConfirmation = pickValue<string>(
      depositData.phone_confirmation,
      depositData.phoneConfirmation,
      depositData.phone_number,
      depositData.phoneNumber,
      depositData.telefono_confirmacion,
      depositData.telefonoConfirmacion,
      depositData.telefono,
      payload.phone_confirmation,
      payload.phoneConfirmation,
      payload.phone_number,
      payload.phoneNumber,
      payload.telefono_confirmacion,
      payload.telefonoConfirmacion,
      payload.telefono
    );

    const normalizedAmount = rawAmount !== undefined ? Number(rawAmount) : undefined;
    const normalizedAmountConfirmation =
      rawAmountConfirmation !== undefined ? Number(rawAmountConfirmation) : undefined;

    const normalizePhoneDigits = (value?: string) => {
      if (!value) return undefined;
      const digits = value.replace(/\D/g, '');
      return digits.length > 0 ? digits : undefined;
    };

    const buildPhoneVariants = (digits?: string) => {
      if (!digits) return [];
      const variants = new Set<string>();
      variants.add(digits);

      if (digits.length === 10) {
        variants.add(`52${digits}`);
        variants.add(`+52${digits}`);
        variants.add(`+521${digits}`);
      } else if (digits.length === 12 && digits.startsWith('52')) {
        const last10 = digits.slice(-10);
        variants.add(last10);
        variants.add(`+52${last10}`);
        variants.add(`+521${last10}`);
      } else if (digits.length === 12 && digits.startsWith('521')) {
        const last10 = digits.slice(-10);
        variants.add(last10);
        variants.add(`52${last10}`);
        variants.add(`+52${last10}`);
      } else if (digits.length === 13 && digits.startsWith('521')) {
        const last10 = digits.slice(-10);
        variants.add(last10);
        variants.add(`52${last10}`);
        variants.add(`+52${last10}`);
      }

      return Array.from(variants);
    };

    const phoneDigits = normalizePhoneDigits(rawPhone);
    const phoneDigitsConfirmation = normalizePhoneDigits(rawPhoneConfirmation ?? rawPhone);

    if (!phoneDigits || !phoneDigitsConfirmation) {
      throw new BadRequestException('Falta el número de teléfono');
    }

    if (!normalizedAmount || !normalizedAmountConfirmation) {
      throw new BadRequestException('Falta el monto del abono');
    }

    // Validar que el teléfono coincida
    if (phoneDigits !== phoneDigitsConfirmation) {
      throw new BadRequestException('Los números de teléfono no coinciden');
    }

    // Validar que el monto coincida
    if (Number(normalizedAmount) !== Number(normalizedAmountConfirmation)) {
      throw new BadRequestException('Los montos no coinciden');
    }

    // Validar que el monto sea positivo
    if (Number(normalizedAmount) <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }

    const canonicalPhone =
      phoneDigits.length === 10 ? `52${phoneDigits}` : phoneDigits;

    const phoneVariants = buildPhoneVariants(phoneDigits);

    const normalizedPosUserId = pickValue<string>(
      depositData.pos_user_id,
      depositData.posUserId,
      depositData.posUserID,
      payload.pos_user_id,
      payload.posUserId,
      payload.posUserID
    );
    const normalizedBranchId = pickValue<string>(
      depositData.branch_id,
      depositData.branchId,
      depositData.branchID,
      payload.branch_id,
      payload.branchId,
      payload.branchID
    );
    const normalizedNotes = pickValue<string>(
      depositData.notes,
      depositData.observaciones,
      depositData.nota,
      payload.notes,
      payload.observaciones,
      payload.nota
    ) ?? null;

    const supabaseClient = this.supabaseService.getClient();
    const supabaseAdmin = this.supabaseService.getAdminClient();
    const client = supabaseAdmin ?? supabaseClient;

    if (!client) {
      throw new BadRequestException('Servicio de base de datos no disponible');
    }

    // Buscar usuario por teléfono (puede no existir aún)
    let user = null;
    try {
      const variantList = phoneVariants.length > 0 ? phoneVariants : [canonicalPhone];

      const { data: users, error } = await client
        .from('app_users')
        .select('id, first_name, last_name, phone_number')
        .in('phone_number', variantList)
        .limit(1);

      if (error) {
        throw error;
      }

      if (users && users.length > 0) {
        user = users[0];
      } else {
        const { data: likeUsers, error: likeError } = await client
      .from('app_users')
      .select('id, first_name, last_name, phone_number')
          .ilike('phone_number', `%${phoneDigits}`)
          .limit(1);

        if (likeError) {
          throw likeError;
        }

        if (likeUsers && likeUsers.length > 0) {
          user = likeUsers[0];
        }
      }
    } catch (error) {
      throw new BadRequestException('Error al buscar usuario');
    }

    const depositPhoneToStore =
      canonicalPhone.length === 12 && canonicalPhone.startsWith('52')
        ? canonicalPhone
        : phoneDigits;

    const phoneConfirmationToStore =
      canonicalPhone.length === 12 && canonicalPhone.startsWith('52')
        ? canonicalPhone
        : phoneDigitsConfirmation;

    // Crear referencia única
    const reference = `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Crear abono
    const { data, error } = await client
      .from('pos_deposits')
      .insert({
        pos_user_id: normalizedPosUserId ?? null,
        branch_id: normalizedBranchId ?? null,
        phone_number: depositPhoneToStore,
        phone_confirmation: phoneConfirmationToStore,
        amount: normalizedAmount,
        amount_confirmation: normalizedAmountConfirmation,
        notes: normalizedNotes,
        app_user_id: user?.id ?? null,
        reference,
        status: 'completed'
      })
      .select('*')
      .single();

    if (error) throw error;

    // Si encontramos usuario, reflejar abono inmediatamente y registrar branch/pos_user

    if (user?.id) {
      await this.supabaseService.applyDepositToUser(
        user.id,
        Number(normalizedAmount),
        reference,
        'Abono desde POS',
        normalizedBranchId ?? null,
        normalizedPosUserId ?? null,
      );

      // Notificar depósito POS al usuario (fire-and-forget)
      this.notificationsService.notifyDeposit(user.id, Number(normalizedAmount));

      // Verificar si este abono activa la recompensa de referido (fire-and-forget)
      this.referralsService.checkAndRewardReferrer(user.id).catch(() => {});
    }

    return data;
  }

  async getDeposits(posUserId?: string, branchId?: string, limit: number = 50) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    let query = this.supabaseService.getClient()
      .from('pos_deposits')
      .select(`
        *
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (posUserId) {
      query = query.eq('pos_user_id', posUserId);
    }

    if (branchId) {
      query = query.eq('branch_id', branchId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async getDepositById(depositId: string) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    const { data, error } = await this.supabaseService.getClient()
      .from('pos_deposits')
      .select(`
        *
      `)
      .eq('id', depositId)
      .single();

    if (error) throw error;
    return data;
  }

  // Obtener estadísticas del POS
  async getPosStats(posUserId: string, branchId: string, dateRange?: { start: string; end: string }) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    let query = this.supabaseService.getClient()
      .from('pos_deposits')
      .select('amount, created_at')
      .eq('pos_user_id', posUserId)
      .eq('branch_id', branchId)
      .eq('status', 'completed');

    if (dateRange) {
      query = query.gte('created_at', dateRange.start).lte('created_at', dateRange.end);
    }

    const { data: deposits, error } = await query;
    if (error) throw error;

    const totalDeposits = deposits.length;
    const totalAmount = deposits.reduce((sum, deposit) => sum + deposit.amount, 0);

    // Estadísticas del día
    const today = new Date().toISOString().split('T')[0];
    const todayDeposits = deposits.filter(deposit => 
      deposit.created_at.startsWith(today)
    );
    const todayAmount = todayDeposits.reduce((sum, deposit) => sum + deposit.amount, 0);

    return {
      total_deposits: totalDeposits,
      total_amount: totalAmount,
      today_deposits: todayDeposits.length,
      today_amount: todayAmount
    };
  }

  // ==================== REPORTES CSV (POS) ====================
  private validateDateString(dateStr: string, fieldName: string) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) {
      throw new BadRequestException(`El formato de ${fieldName} debe ser YYYY-MM-DD`);
    }
  }

  private formatMexicoDate(date: Date | string) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const obj: Record<string, string> = {};
    parts.forEach(p => { if (p.type !== 'literal') obj[p.type] = p.value; });
    return `${obj.year}-${obj.month}-${obj.day} ${obj.hour}:${obj.minute}:${obj.second}`;
  }

  private mapTransactionType(type?: string): string {
    switch (type) {
      case 'deposit': return 'Abono';
      case 'withdrawal': return 'Retiro';
      case 'investment': return 'Inversión';
      case 'payment': return 'Compra';
      default: return type || '';
    }
  }

  private buildCsv(rows: string[][]): string {
    const escape = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    return rows.map(r => r.map(escape).join(',')).join('\n');
  }

  async generateCsvReport(options: {
    branchId?: string;
    brandId?: string;
    startDate?: string;
    endDate?: string;
    includePhone: boolean;
  }) {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new BadRequestException('Supabase no configurado');
    }

    const todayMexico = this.formatMexicoDate(new Date()).split(' ')[0];
    let start = options.startDate;
    let end = options.endDate;

    if (start) this.validateDateString(start, 'fechaInicio');
    if (end) this.validateDateString(end, 'fechaFin');

    if (start && !end) end = todayMexico;
    if (!start && end) start = '1900-01-01';
    if (!start) start = '1900-01-01';
    if (!end) end = todayMexico;
    if (start && end && end < start) {
      throw new BadRequestException('La fecha de fin debe ser posterior o igual a la fecha de inicio');
    }

    // Validate branch if provided and get brand_id
    let branchName: string | null = null;
    let brandIdFromBranch: string | null = null;
    
    if (options.branchId) {
      const { data: branch, error: branchError } = await client
        .from('branches')
        .select('id, name, brand_id')
        .eq('id', options.branchId)
        .maybeSingle();
      if (branchError || !branch) {
        throw new BadRequestException('Sucursal no encontrada');
      }
      branchName = branch.name;
      brandIdFromBranch = branch.brand_id;
    }

    // Use brandId from options or from branch
    const brandId = options.brandId || brandIdFromBranch;
    
    if (!brandId) {
      throw new BadRequestException('Se requiere brandId o branchId para generar el reporte');
    }

    // Validate brand exists
    const { data: brand, error: brandError } = await client
      .from('brands')
      .select('id, name')
      .eq('id', brandId)
      .maybeSingle();
    
    if (brandError || !brand) {
      throw new BadRequestException('Marca no encontrada');
    }

    // Get all branch IDs for this brand
    const { data: brandBranches, error: branchesError } = await client
      .from('branches')
      .select('id')
      .eq('brand_id', brandId);
    
    if (branchesError) {
      throw new BadRequestException(`Error al obtener sucursales de la marca: ${branchesError.message}`);
    }

    const branchIds = brandBranches?.map(b => b.id) || [];
    
    if (branchIds.length === 0) {
      // No branches for this brand, return empty CSV
      const rows: string[][] = [];
      if (options.includePhone) {
        rows.push(['Teléfono', 'Monto', 'Tipo', 'Autorización', 'Sucursal', 'Fecha (México)']);
      } else {
        rows.push(['Monto', 'Tipo', 'Autorización', 'Sucursal', 'Fecha (México)']);
      }
      return this.buildCsv(rows);
    }

    let query = client
      .from('transactions')
      .select(`
        id,
        amount,
        type,
        reference,
        created_at,
        branch_id,
        user_id,
        branch:branches!transactions_branch_id_fkey(name, id, brand_id),
        user_from:app_users!transactions_user_id_fkey(phone_number)
      `)
      .order('created_at', { ascending: false })
      .gte('created_at', `${start}T00:00:00.000Z`)
      .lte('created_at', `${end}T23:59:59.999Z`)
      .in('branch_id', branchIds); // Filter by brand's branches

    // If specific branch is provided, further filter by that branch
    if (options.branchId) {
      query = query.eq('branch_id', options.branchId);
    }

    const { data, error } = await query;
    if (error) {
      throw new BadRequestException(`Error al obtener transacciones: ${error.message}`);
    }

    const rows: string[][] = [];
    if (options.includePhone) {
      rows.push(['Teléfono', 'Monto', 'Tipo', 'Autorización', 'Sucursal', 'Fecha (México)']);
    } else {
      rows.push(['Monto', 'Tipo', 'Autorización', 'Sucursal', 'Fecha (México)']);
    }

    for (const tx of data || []) {
      const userNode = Array.isArray(tx.user_from) ? tx.user_from[0] : tx.user_from;
      const branchNode = Array.isArray(tx.branch) ? tx.branch[0] : tx.branch;

      const phoneRaw = userNode?.phone_number ?? '';
      const phone = phoneRaw ? String(phoneRaw).replace(/\D/g, '').slice(-10) : '';
      const amount = tx.amount ?? 0;
      const type = this.mapTransactionType(tx.type);
      const auth = tx.reference || '';
      const branchLabel = branchNode?.name || branchName || 'Sin sucursal';
      const fecha = this.formatMexicoDate(tx.created_at);

      if (options.includePhone) {
        rows.push([phone, Number(amount).toFixed(2), type, auth, branchLabel, fecha]);
      } else {
        rows.push([Number(amount).toFixed(2), type, auth, branchLabel, fecha]);
      }
    }

    return this.buildCsv(rows);
  }

  // Sistema de pagos con CENT (requiere OTP)
  async processPayment(paymentData: {
    pos_user_id?: string;
    branch_id?: string;
    phone_number?: string;
    phone_confirmation?: string;
    amount?: number;
    amount_confirmation?: number;
    otp?: string;
    notes?: string;
    payload?: any;
    posUserId?: string;
    branchId?: string;
    posUserID?: string;
    branchID?: string;
    phoneNumber?: string;
    phoneConfirmation?: string;
    telefono?: string;
    telefono_confirmacion?: string;
    telefonoConfirmacion?: string;
    monto?: number | string;
    monto_confirmacion?: number | string;
    montoConfirmacion?: number | string;
    amountConfirmation?: number | string;
    observaciones?: string;
    nota?: string;
  }) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Sistema no disponible');
    }

    const pickValue = <T>(...values: Array<T | undefined | null>): T | undefined => {
      for (const value of values) {
        if (value !== undefined && value !== null && value !== '') {
          return value as T;
        }
      }
      return undefined;
    };

    const payload = paymentData.payload ?? {};

    // Normalizar teléfono
    const normalizePhoneDigits = (value?: string) => {
      if (!value) return undefined;
      const digits = value.replace(/\D/g, '');
      return digits.length > 0 ? digits : undefined;
    };

    const rawPhone = pickValue<string>(
      paymentData.phone_number,
      paymentData.phoneNumber,
      paymentData.phone_confirmation,
      paymentData.phoneConfirmation,
      paymentData.telefono,
      paymentData.telefono_confirmacion,
      paymentData.telefonoConfirmacion,
      payload.phone_number,
      payload.phoneNumber,
      payload.phone_confirmation,
      payload.phoneConfirmation,
      payload.telefono,
      payload.telefono_confirmacion,
      payload.telefonoConfirmacion
    );

    const rawPhoneConfirmation = pickValue<string>(
      paymentData.phone_confirmation,
      paymentData.phoneConfirmation,
      paymentData.phone_number,
      paymentData.phoneNumber,
      paymentData.telefono_confirmacion,
      paymentData.telefonoConfirmacion,
      paymentData.telefono,
      payload.phone_confirmation,
      payload.phoneConfirmation,
      payload.phone_number,
      payload.phoneNumber,
      payload.telefono_confirmacion,
      payload.telefonoConfirmacion,
      payload.telefono
    );

    const phoneDigits = normalizePhoneDigits(rawPhone);
    const phoneDigitsConfirmation = normalizePhoneDigits(rawPhoneConfirmation ?? rawPhone);

    if (!phoneDigits || !phoneDigitsConfirmation) {
      throw new BadRequestException('Falta el número de teléfono');
    }

    if (phoneDigits !== phoneDigitsConfirmation) {
      throw new BadRequestException('Los números de teléfono no coinciden');
    }

    // Normalizar monto
    const rawAmount = pickValue<number | string>(
      paymentData.amount,
      paymentData.amount_confirmation,
      paymentData.amountConfirmation,
      paymentData.monto,
      paymentData.monto_confirmacion,
      paymentData.montoConfirmacion,
      payload.amount,
      payload.amount_confirmation,
      payload.amountConfirmation,
      payload.monto,
      payload.monto_confirmacion,
      payload.montoConfirmacion
    );

    const rawAmountConfirmation = pickValue<number | string>(
      paymentData.amount_confirmation,
      paymentData.amountConfirmation,
      paymentData.amount,
      paymentData.monto_confirmacion,
      paymentData.montoConfirmacion,
      paymentData.monto,
      payload.amount_confirmation,
      payload.amountConfirmation,
      payload.amount,
      payload.monto_confirmacion,
      payload.montoConfirmacion,
      payload.monto
    );

    const normalizedAmount = rawAmount !== undefined ? Number(rawAmount) : undefined;
    const normalizedAmountConfirmation =
      rawAmountConfirmation !== undefined ? Number(rawAmountConfirmation) : undefined;

    if (!normalizedAmount || !normalizedAmountConfirmation) {
      throw new BadRequestException('Falta el monto del pago');
    }

    if (Number(normalizedAmount) !== Number(normalizedAmountConfirmation)) {
      throw new BadRequestException('Los montos no coinciden');
    }

    if (Number(normalizedAmount) <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }

    // Validar OTP
    const otp = pickValue<string>(
      paymentData.otp,
      payload.otp
    );

    if (!otp) {
      throw new BadRequestException('Falta el código OTP');
    }

    // Verificar OTP
    const canonicalPhone = phoneDigits.length === 10 ? `52${phoneDigits}` : phoneDigits;
    const otpVerification = await this.paymentOtpService.verifyPaymentOtp(canonicalPhone, otp);

    if (!otpVerification.valid || !otpVerification.userId) {
      throw new BadRequestException('Código OTP inválido o expirado');
    }

    const userId = otpVerification.userId;

    // Verificar saldo disponible
    const userBalance = await this.balanceService.getAvailableBalance(userId);
    if (userBalance.availableBalance < Number(normalizedAmount)) {
      throw new BadRequestException(
        `Saldo insuficiente. Disponible: $${userBalance.availableBalance.toFixed(2)}, Solicitado: $${Number(normalizedAmount).toFixed(2)}`
      );
    }

    // Restar del saldo disponible
    const reference = `PAY-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.balanceService.deductBalance(
      userId,
      Number(normalizedAmount),
      reference,
      'Pago desde POS',
      true
    );

    // Normalizar datos del POS
    const normalizedPosUserId = pickValue<string>(
      paymentData.pos_user_id,
      paymentData.posUserId,
      paymentData.posUserID,
      payload.pos_user_id,
      payload.posUserId,
      payload.posUserID
    );

    const normalizedBranchId = pickValue<string>(
      paymentData.branch_id,
      paymentData.branchId,
      paymentData.branchID,
      payload.branch_id,
      payload.branchId,
      payload.branchID
    );

    const normalizedNotes = pickValue<string>(
      paymentData.notes,
      paymentData.observaciones,
      paymentData.nota,
      payload.notes,
      payload.observaciones,
      payload.nota
    );

    // Registrar transacción en la tabla transactions para que aparezca en estado de cuenta
    const client = this.supabaseService.getAdminClient() ?? this.supabaseService.getClient();
    if (client) {
      try {
        const { error: transactionError } = await client
          .from('transactions')
          .insert({
            user_id: userId,
            branch_id: normalizedBranchId ?? null,
            pos_user_id: normalizedPosUserId ?? null,
            type: 'payment',
            amount: Number(normalizedAmount),
            description: 'Pago desde POS',
            reference,
            status: 'completed',
            metadata: {
              phone_number: canonicalPhone,
              notes: normalizedNotes,
            },
          });

        if (transactionError) {
          console.error('Error registrando transacción de pago:', {
            error: transactionError,
            code: transactionError.code,
            message: transactionError.message,
            userId,
            reference,
          });
          // No lanzar error aquí para no afectar el pago, pero loguearlo
        } else {
        }
      } catch (error) {
        console.error('Error inesperado registrando transacción:', error);
        // Continuar sin error para no afectar el pago
      }

      // Intentar insertar en pos_payments si existe (opcional, no crítico)
      try {
        const { error: paymentError } = await client
          .from('pos_payments')
          .insert({
            pos_user_id: normalizedPosUserId ?? null,
            branch_id: normalizedBranchId ?? null,
            phone_number: canonicalPhone,
            phone_confirmation: canonicalPhone,
            amount: Number(normalizedAmount),
            amount_confirmation: Number(normalizedAmountConfirmation),
            app_user_id: userId,
            reference,
            status: 'completed',
            notes: normalizedNotes,
          });

        // PGRST205 = tabla no existe, ignorar este error
        if (paymentError && paymentError.code !== 'PGRST205' && paymentError.code !== '42P01') {
          console.error('Error registrando pago en pos_payments:', paymentError);
        } else if (paymentError && (paymentError.code === 'PGRST205' || paymentError.code === '42P01')) {
          // Tabla no existe, es normal, solo loguear
        }
      } catch (error) {
        // Si la tabla no existe, continuar sin error
      }
    }

    return {
      id: reference,
      pos_user_id: normalizedPosUserId ?? null,
      branch_id: normalizedBranchId ?? null,
      phone_number: canonicalPhone,
      amount: Number(normalizedAmount),
      reference,
      status: 'completed',
      app_user_id: userId,
      notes: normalizedNotes,
      created_at: new Date().toISOString(),
    };
  }

  // Sistema de cancelación de transacciones
  async getRecentTransactions(phoneNumber: string, phoneConfirmation: string) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Sistema no disponible');
    }

    // Normalizar teléfonos
    const normalizePhoneDigits = (value?: string) => {
      if (!value) return undefined;
      const digits = value.replace(/\D/g, '');
      return digits.length > 0 ? digits : undefined;
    };

    const phoneDigits = normalizePhoneDigits(phoneNumber);
    const phoneDigitsConfirmation = normalizePhoneDigits(phoneConfirmation);

    if (!phoneDigits || !phoneDigitsConfirmation) {
      throw new BadRequestException('Falta el número de teléfono');
    }

    if (phoneDigits !== phoneDigitsConfirmation) {
      throw new BadRequestException('Los números de teléfono no coinciden');
    }

    const canonicalPhone = phoneDigits.length === 10 ? `52${phoneDigits}` : phoneDigits;

    // Buscar usuario por teléfono
    const client = this.supabaseService.getAdminClient() ?? this.supabaseService.getClient();
    if (!client) {
      throw new BadRequestException('Sistema no disponible');
    }

    // Buscar usuario
    const { data: user, error: userError } = await client
      .from('app_users')
      .select('id, phone_number')
      .or(`phone_number.eq.${canonicalPhone},phone_number.eq.${phoneDigits},phone_number.ilike.%${phoneDigits.slice(-10)}%`)
      .limit(1)
      .single();

    if (userError || !user) {
      throw new BadRequestException('Usuario no encontrado');
    }

    const userId = user.id;

    // Calcular fecha de hace 30 minutos
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // Obtener abonos recientes (pos_deposits)
    const { data: deposits, error: depositsError } = await client
      .from('pos_deposits')
      .select('*')
      .eq('phone_number', canonicalPhone)
      .eq('status', 'completed')
      .gte('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false });

    if (depositsError) {
      console.error('Error obteniendo abonos:', depositsError);
    }

    // Obtener pagos recientes (transactions con type='payment')
    const { data: payments, error: paymentsError } = await client
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .eq('type', 'payment')
      .eq('status', 'completed')
      .gte('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false });

    if (paymentsError) {
      console.error('Error obteniendo pagos:', paymentsError);
    }

    // Formatear resultados
    const transactions = [];

    // Agregar abonos
    if (deposits) {
      for (const deposit of deposits) {
        transactions.push({
          id: deposit.id,
          type: 'deposit',
          amount: Number(deposit.amount || 0),
          reference: deposit.reference,
          description: 'Abono desde POS',
          status: deposit.status,
          created_at: deposit.created_at,
          pos_user_id: deposit.pos_user_id,
          branch_id: deposit.branch_id,
          notes: deposit.notes,
        });
      }
    }

    // Agregar pagos
    if (payments) {
      for (const payment of payments) {
        transactions.push({
          id: payment.id,
          type: 'payment',
          amount: Number(payment.amount || 0),
          reference: payment.reference,
          description: payment.description || 'Pago desde POS',
          status: payment.status,
          created_at: payment.created_at,
          pos_user_id: payment.pos_user_id,
          branch_id: payment.branch_id,
          metadata: payment.metadata,
        });
      }
    }

    // Ordenar por fecha (más reciente primero)
    transactions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      phone_number: canonicalPhone,
      user_id: userId,
      transactions,
      total: transactions.length,
    };
  }

  async cancelTransaction(cancelData: {
    phone_number?: string;
    phone_confirmation?: string;
    transaction_id?: string;
    transaction_type?: string;
    otp?: string;
    pos_user_id?: string;
    branch_id?: string;
    notes?: string;
  }) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Sistema no disponible');
    }

    const pickValue = <T>(...values: Array<T | undefined | null>): T | undefined => {
      for (const value of values) {
        if (value !== undefined && value !== null && value !== '') {
          return value as T;
        }
      }
      return undefined;
    };

    // Validar teléfono
    const normalizePhoneDigits = (value?: string) => {
      if (!value) return undefined;
      const digits = value.replace(/\D/g, '');
      return digits.length > 0 ? digits : undefined;
    };

    const rawPhone = pickValue<string>(cancelData.phone_number);
    const rawPhoneConfirmation = pickValue<string>(cancelData.phone_confirmation);

    const phoneDigits = normalizePhoneDigits(rawPhone);
    const phoneDigitsConfirmation = normalizePhoneDigits(rawPhoneConfirmation);

    if (!phoneDigits || !phoneDigitsConfirmation) {
      throw new BadRequestException('Falta el número de teléfono');
    }

    if (phoneDigits !== phoneDigitsConfirmation) {
      throw new BadRequestException('Los números de teléfono no coinciden');
    }

    const canonicalPhone = phoneDigits.length === 10 ? `52${phoneDigits}` : phoneDigits;

    // Validar OTP
    const otp = pickValue<string>(cancelData.otp);
    if (!otp) {
      throw new BadRequestException('Falta el código OTP');
    }

    const otpVerification = await this.paymentOtpService.verifyPaymentOtp(canonicalPhone, otp);
    if (!otpVerification.valid || !otpVerification.userId) {
      throw new BadRequestException('Código OTP inválido o expirado');
    }

    const userId = otpVerification.userId;

    // Validar datos de transacción
    const transactionId = pickValue<string>(cancelData.transaction_id);
    const transactionType = pickValue<string>(cancelData.transaction_type);

    if (!transactionId || !transactionType) {
      throw new BadRequestException('Falta el ID o tipo de transacción');
    }

    if (transactionType !== 'deposit' && transactionType !== 'payment') {
      throw new BadRequestException('Tipo de transacción inválido');
    }

    const client = this.supabaseService.getAdminClient() ?? this.supabaseService.getClient();
    if (!client) {
      throw new BadRequestException('Sistema no disponible');
    }

    // Obtener transacción
    let transaction: any = null;
    let amount = 0;
    let reference = '';

    if (transactionType === 'deposit') {
      // Buscar en pos_deposits
      const { data: deposit, error: depositError } = await client
        .from('pos_deposits')
        .select('*')
        .eq('id', transactionId)
        .eq('phone_number', canonicalPhone)
        .eq('status', 'completed')
        .single();

      if (depositError || !deposit) {
        throw new BadRequestException('Abono no encontrado o ya cancelado');
      }

      transaction = deposit;
      amount = Number(deposit.amount || 0);
      reference = deposit.reference || `DEP-${transactionId}`;
    } else {
      // Buscar en transactions
      const { data: payment, error: paymentError } = await client
        .from('transactions')
        .select('*')
        .eq('id', transactionId)
        .eq('user_id', userId)
        .eq('type', 'payment')
        .eq('status', 'completed')
        .single();

      if (paymentError || !payment) {
        throw new BadRequestException('Pago no encontrado o ya cancelado');
      }

      transaction = payment;
      amount = Number(payment.amount || 0);
      reference = payment.reference || `PAY-${transactionId}`;
    }

    if (amount <= 0) {
      throw new BadRequestException('Monto inválido');
    }

    // Reversar la transacción
    const cancelReference = `CANCEL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (transactionType === 'deposit') {
      // Si es abono, restar del saldo (reversar el abono)
      await this.balanceService.deductBalance(
        userId,
        amount,
        cancelReference,
        `Cancelación de abono: ${reference}`,
        true
      );
    } else {
      // Si es pago, devolver el saldo (reversar el pago)
      await this.balanceService.addBalance(
        userId,
        amount,
        cancelReference,
        `Cancelación de pago: ${reference}`
      );
    }

    // Actualizar estado de la transacción
    if (transactionType === 'deposit') {
      const { error: updateError } = await client
        .from('pos_deposits')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', transactionId);

      if (updateError) {
        console.error('Error actualizando estado de abono:', updateError);
      }
    } else {
      const { error: updateError } = await client
        .from('transactions')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', transactionId);

      if (updateError) {
        console.error('Error actualizando estado de pago:', updateError);
      }
    }

    // Registrar transacción de cancelación
    const normalizedPosUserId = pickValue<string>(cancelData.pos_user_id);
    const normalizedBranchId = pickValue<string>(cancelData.branch_id);
    const normalizedNotes = pickValue<string>(cancelData.notes);

    try {
      await client
        .from('transactions')
        .insert({
          user_id: userId,
          branch_id: normalizedBranchId ?? null,
          pos_user_id: normalizedPosUserId ?? null,
          type: transactionType === 'deposit' ? 'withdrawal' : 'deposit',
          amount: transactionType === 'deposit' ? -amount : amount,
          description: `Cancelación de ${transactionType === 'deposit' ? 'abono' : 'pago'}: ${reference}`,
          reference: cancelReference,
          status: 'completed',
          metadata: {
            cancelled_transaction_id: transactionId,
            cancelled_transaction_type: transactionType,
            cancelled_reference: reference,
            notes: normalizedNotes,
          },
        });
    } catch (error) {
      console.error('Error registrando transacción de cancelación:', error);
      // No lanzar error, la cancelación ya se procesó
    }

    return {
      success: true,
      cancelled_transaction: {
        id: transactionId,
        type: transactionType,
        amount,
        reference,
      },
      cancel_reference: cancelReference,
      message: `Transacción ${transactionType === 'deposit' ? 'abono' : 'pago'} cancelada exitosamente`,
    };
  }
}