import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { OtpService } from '../auth/otp.service';
import { BalanceService } from '../balance/balance.service';
import { InvestmentRatesService } from '../investment-rates/investment-rates.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateInvestmentRateDto } from '../types/investment-rate';

@Injectable()
export class AdminService {
  constructor(
    private supabaseService: SupabaseService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private otpService: OtpService,
    private balanceService: BalanceService,
    private investmentRatesService: InvestmentRatesService
  ) {}

  private normalizePhone(phone?: string) {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (!digits) return null;
    const variants = new Set<string>();
    variants.add(digits);
    if (digits.length === 10) {
      variants.add(`52${digits}`);
      variants.add(`+52${digits}`);
      variants.add(`+521${digits}`);
    }
    return Array.from(variants);
  }

  // Autenticación de administradores
  async loginAdmin(email: string, password: string) {
    if (!this.supabaseService.getClient()) {
      throw new UnauthorizedException('Supabase no configurado');
    }

    const client = this.supabaseService.getAdminClient();

    // 1. Buscar primero en admin_users
    const { data: admin } = await client
      .from('admin_users')
      .select('*')
      .eq('email', email.trim().toLowerCase())
      .eq('is_active', true)
      .maybeSingle();

    if (admin) {
      const isPasswordValid = await bcrypt.compare(password, admin.password);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Contraseña incorrecta');
      }

      const token = this.jwtService.sign(
        { sub: admin.id, email: admin.email, role: 'admin' },
        { expiresIn: '7d' },
      );
      return { accessToken: token, user: { id: admin.id, email: admin.email, role: admin.role } };
    }

    // 2. Fallback: buscar en pos_users (usuarios creados desde el panel de catálogo)
    const { data: posUser } = await client
      .from('pos_users')
      .select('id, email, full_name, role, password, is_active')
      .eq('email', email.trim().toLowerCase())
      .eq('is_active', true)
      .maybeSingle();

    if (!posUser) {
      throw new UnauthorizedException('Administrador no encontrado');
    }

    const isPosPasswordValid = await bcrypt.compare(password, posUser.password);
    if (!isPosPasswordValid) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }

    const token = this.jwtService.sign(
      { sub: posUser.id, email: posUser.email, role: 'admin' },
      { expiresIn: '7d' },
    );
    return { accessToken: token, user: { id: posUser.id, email: posUser.email, role: posUser.role } };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Gestión de usuarios admin (solo master puede crear/modificar)
  // ──────────────────────────────────────────────────────────────────────────

  async createAdminUser(data: {
    email: string;
    password: string;
    name: string;
    role?: string;
  }) {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new Error('Supabase no configurado');
    }

    // Verificar que el email no exista ya
    const { data: existing } = await client
      .from('admin_users')
      .select('id')
      .eq('email', data.email.trim().toLowerCase())
      .maybeSingle();

    if (existing) {
      throw new ConflictException('Ya existe un administrador con ese email');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const { data: created, error } = await client
      .from('admin_users')
      .insert({
        email: data.email.trim().toLowerCase(),
        password: hashedPassword,
        ...(data.name ? { name: data.name } : {}),
        role: data.role ?? 'admin',
        is_active: true,
      })
      .select('id, email, name, role, is_active, created_at')
      .single();

    if (error) throw error;
    return created;
  }

  async getAdminUsers() {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      return [];
    }

    const { data, error } = await client
      .from('admin_users')
      .select('id, email, name, role, is_active, created_at, last_login')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  async updateAdminUser(
    adminId: string,
    updateData: { name?: string; role?: string; is_active?: boolean; password?: string },
  ) {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      return { id: adminId, ...updateData };
    }

    const payload: Record<string, any> = {};
    if (updateData.name !== undefined) payload.name = updateData.name;
    if (updateData.role !== undefined) payload.role = updateData.role;
    if (updateData.is_active !== undefined) payload.is_active = updateData.is_active;
    if (updateData.password) {
      payload.password = await bcrypt.hash(updateData.password, 10);
    }

    if (!Object.keys(payload).length) {
      throw new BadRequestException('No se enviaron campos a actualizar');
    }

    const { data, error } = await client
      .from('admin_users')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', adminId)
      .select('id, email, name, role, is_active, created_at')
      .single();

    if (error) throw error;
    return data;
  }

  async deleteAdminUser(adminId: string) {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      return { message: 'Usuario desactivado (demo)' };
    }

    // Soft delete: desactivar en lugar de eliminar
    const { error } = await client
      .from('admin_users')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', adminId);

    if (error) throw error;
    return { message: 'Usuario administrador desactivado correctamente' };
  }

  async getExternalTransfers(filters: {
    userId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    search?: string;
  }) {
    return this.supabaseService.getExternalTransfers(
      filters.userId,
      filters.limit ?? 50,
      {
        status: filters.status,
        startDate: filters.startDate,
        endDate: filters.endDate,
        search: filters.search,
      }
    );
  }

  private maskClabe(clabe?: string | null): string | null {
    if (!clabe) return null;
    const normalized = String(clabe).replace(/\s/g, '');
    if (normalized.length <= 4) return '****';
    return `${'*'.repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
  }

  private normalizeExternalTransferStatus(status?: string): 'pending' | 'completed' | null {
    const normalized = status?.trim().toLowerCase();
    if (normalized === 'pending') {
      return 'pending';
    }
    if (normalized === 'completed' || normalized === 'approved') {
      return 'completed';
    }
    return null;
  }

  private externalTransferStatusesMatch(stored?: string, target?: 'pending' | 'completed'): boolean {
    if (!stored || !target) return false;
    const normalizedStored = stored === 'approved' ? 'completed' : stored;
    return normalizedStored === target;
  }

  async updateExternalTransferStatus(
    transferId: string,
    adminId: string,
    updateData: { status?: string }
  ) {
    if (!updateData?.status) {
      throw new BadRequestException('El campo status es requerido');
    }

    const targetStatus = this.normalizeExternalTransferStatus(updateData.status);
    if (!targetStatus) {
      throw new BadRequestException(
        'Estado inválido. Valores permitidos: pending, completed (también approved por compatibilidad)',
      );
    }

    const client = this.supabaseService.getAdminClient();
    const now = new Date().toISOString();

    if (!client) {
      return {
        id: transferId,
        status: targetStatus,
        updated_at: now,
        ...(targetStatus === 'completed'
          ? { approved_by: adminId, approved_at: now }
          : { approved_by: null, approved_at: null }),
      };
    }

    const { data: currentTransfer, error: fetchError } = await client
      .from('external_transfers')
      .select('*')
      .eq('id', transferId)
      .maybeSingle();

    if (fetchError) {
      throw new InternalServerErrorException(`Error al obtener transferencia externa: ${fetchError.message}`);
    }

    if (!currentTransfer) {
      throw new NotFoundException('Transferencia externa no encontrada');
    }

    const previousStatus = currentTransfer.status;
    const maskedClabe = this.maskClabe(currentTransfer.clabe);

    if (this.externalTransferStatusesMatch(previousStatus, targetStatus)) {
      return currentTransfer;
    }

    const updatePayloadWithAudit: Record<string, any> = {
      status: targetStatus,
      updated_at: now,
      approved_at: targetStatus === 'completed' ? now : null,
      approved_by: targetStatus === 'completed' ? adminId : null,
    };

    let updatedTransfer: any = null;
    let updateError: any = null;

    ({ data: updatedTransfer, error: updateError } = await client
      .from('external_transfers')
      .update(updatePayloadWithAudit)
      .eq('id', transferId)
      .select('*')
      .maybeSingle());

    if (updateError && /approved_at|approved_by/i.test(updateError.message || '')) {
      const metadata = { ...(currentTransfer.metadata ?? {}) };
      if (targetStatus === 'completed') {
        metadata.approval = {
          approved_at: now,
          approved_by: adminId,
        };
      } else {
        delete metadata.approval;
      }

      ({ data: updatedTransfer, error: updateError } = await client
        .from('external_transfers')
        .update({
          status: targetStatus,
          updated_at: now,
          metadata,
        })
        .eq('id', transferId)
        .select('*')
        .maybeSingle());
    }

    if (!updatedTransfer && !updateError) {
      const { data: latest, error: latestError } = await client
        .from('external_transfers')
        .select('*')
        .eq('id', transferId)
        .maybeSingle();

      if (latestError) {
        throw new InternalServerErrorException(`Error al validar concurrencia: ${latestError.message}`);
      }

      if (!latest) {
        throw new NotFoundException('Transferencia externa no encontrada');
      }

      if (this.externalTransferStatusesMatch(latest.status, targetStatus)) {
        return latest;
      }

      throw new ConflictException('No se pudo actualizar el estado de la transferencia externa');
    }

    if (updateError) {
      throw new InternalServerErrorException(`Error al actualizar transferencia externa: ${updateError.message}`);
    }

    // Sincronizar el status en la tabla transactions (que lee el estado de cuenta)
    const transactionId = currentTransfer.transaction_id;
    if (transactionId) {
      const { error: txUpdateError } = await client
        .from('transactions')
        .update({ status: targetStatus, updated_at: now })
        .eq('id', transactionId);

      if (txUpdateError) {
        console.error('[ADMIN][EXTERNAL_TRANSFER_STATUS] Error syncing transactions table:', txUpdateError.message);
      } else {
      }
    }


    return updatedTransfer;
  }

  // Gestión de marcas
  async createBrand(name: string, alias: string) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    const { data, error } = await this.supabaseService.getAdminClient()
      .from('brands')
      .insert({ name, alias })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getBrands() {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    const { data, error } = await this.supabaseService.getAdminClient()
      .from('branches')
      .insert({
        brand_id: brandId,
        ...branchData
      })
      .select(`
        *,
        brands!inner(name, alias)
      `)
      .single();

    if (error) throw error;
    return data;
  }

  async getBranches(brandId?: string) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    // Verificar que el email no exista
    const { data: existingUser } = await this.supabaseService.getAdminClient()
      .from('pos_users')
      .select('id')
      .eq('email', userData.email)
      .single();

    if (existingUser) {
      throw new BadRequestException('El email ya está registrado');
    }

    // Hashear contraseña
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    const { data, error } = await this.supabaseService.getAdminClient()
      .from('pos_users')
      .insert({
        branch_id: branchId,
        ...userData,
        password: hashedPassword
      })
      .select(`
        *,
        branches!inner(name, alias, brands!inner(name, alias))
      `)
      .single();

    if (error) throw error;
    return data;
  }

  async getPosUsers(branchId?: string) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    // Normalizar teléfono (remover caracteres no numéricos)
    const normalizedPhone = phone.replace(/\D/g, '');
    
    // Buscar variantes del teléfono
    const phoneVariants = [
      normalizedPhone,
      `52${normalizedPhone}`,
      `+52${normalizedPhone}`,
      `+521${normalizedPhone}`
    ];

    const { data: user, error } = await this.supabaseService.getAdminClient()
      .from('app_users')
      .select('*')
      .in('phone_number', phoneVariants)
      .maybeSingle();

    if (error) {
      throw new BadRequestException(`Error al buscar cliente: ${error.message}`);
    }

    if (!user) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // Build full address from components
    const addressParts = [
      user.address_street,
      user.address_number ? `#${user.address_number}` : null,
      user.address_colony
    ].filter(Boolean);
    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

    return {
      id: user.id,
      name: user.first_name,
      lastName: user.last_name,
      dateOfBirth: user.date_of_birth || null,
      address: fullAddress,
      city: user.address_city || null,
      state: user.address_state || null,
      zipCode: user.address_postal_code || null,
      email: user.email || null,
      phone: user.phone_number,
      clabe: null // CLABE is not stored in app_users, only in transactions for external transfers
    };
  }

  async getCustomerById(customerId: string) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    const { data: user, error } = await this.supabaseService.getAdminClient()
      .from('app_users')
      .select('*')
      .eq('id', customerId)
      .single();

    if (error || !user) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // Build full address from components
    const addressParts = [
      user.address_street,
      user.address_number ? `#${user.address_number}` : null,
      user.address_colony
    ].filter(Boolean);
    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

    return {
      id: user.id,
      name: user.first_name,
      lastName: user.last_name,
      dateOfBirth: user.date_of_birth || null,
      address: fullAddress,
      city: user.address_city || null,
      state: user.address_state || null,
      zipCode: user.address_postal_code || null,
      email: user.email || null,
      phone: user.phone_number,
      clabe: null, // CLABE is not stored in app_users, only in transactions for external transfers
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  }

  async updateCustomer(customerId: string, updateData: {
    name?: string;
    lastName?: string;
    dateOfBirth?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    email?: string;
    phone?: string;
    clabe?: string;
  }) {
    // Validaciones
    if (updateData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updateData.email)) {
      throw new BadRequestException('El email no es válido');
    }
    if (updateData.phone && updateData.phone.replace(/\D/g, '').length !== 10) {
      throw new BadRequestException('El teléfono debe tener 10 dígitos');
    }
    if (updateData.clabe && updateData.clabe.length !== 18) {
      throw new BadRequestException('La CLABE debe tener 18 dígitos');
    }
    if (updateData.zipCode && updateData.zipCode.length !== 5) {
      throw new BadRequestException('El código postal debe tener 5 dígitos');
    }

    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    const updatePayload: any = {};
    if (updateData.name) updatePayload.first_name = updateData.name;
    if (updateData.lastName) updatePayload.last_name = updateData.lastName;
    if (updateData.dateOfBirth) updatePayload.date_of_birth = updateData.dateOfBirth;
    // Address parsing: if address is provided, try to split it, otherwise use individual fields
    if (updateData.address) {
      // Try to parse address into components (simple approach)
      // For now, store the full address in address_street
      updatePayload.address_street = updateData.address;
    }
    if (updateData.city) updatePayload.address_city = updateData.city;
    if (updateData.state) updatePayload.address_state = updateData.state;
    if (updateData.zipCode) updatePayload.address_postal_code = updateData.zipCode;
    if (updateData.email) updatePayload.email = updateData.email;
    if (updateData.phone) updatePayload.phone_number = updateData.phone.replace(/\D/g, '');
    // Note: CLABE is not stored in app_users table, only in transactions for external transfers
    // If CLABE needs to be stored, it should be added as a new column or stored in a separate table
    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await this.supabaseService.getAdminClient()
      .from('app_users')
      .update(updatePayload)
      .eq('id', customerId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Error al actualizar cliente: ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException('Cliente no encontrado');
    }

    // Build full address from components
    const addressParts = [
      data.address_street,
      data.address_number ? `#${data.address_number}` : null,
      data.address_colony
    ].filter(Boolean);
    const fullAddress = addressParts.length > 0 ? addressParts.join(', ') : null;

    return {
      id: data.id,
      name: data.first_name,
      lastName: data.last_name,
      dateOfBirth: data.date_of_birth || null,
      address: fullAddress,
      city: data.address_city || null,
      state: data.address_state || null,
      zipCode: data.address_postal_code || null,
      email: data.email || null,
      phone: data.phone_number,
      clabe: null, // CLABE is not stored in app_users
      updated_at: data.updated_at
    };
  }

  async sendOtpToCustomer(customerId: string, type: 'email' | 'phone' | 'both' = 'phone') {
    const customer = await this.getCustomerById(customerId);
    
    if (type === 'phone' || type === 'both') {
      if (!customer.phone) {
        throw new BadRequestException('El cliente no tiene teléfono registrado');
      }
      const phoneDigits = customer.phone.replace(/\D/g, '');
      const last10 = phoneDigits.slice(-10);
      await this.otpService.sendOtp(last10);
    }

    if (type === 'email' || type === 'both') {
      if (!customer.email) {
        throw new BadRequestException('El cliente no tiene email registrado');
      }
      throw new BadRequestException('El envío de OTP por email no está disponible');
    }

    return {
      message: 'Código OTP enviado exitosamente',
      expiresIn: 300,
      sentTo: type
    };
  }

  async verifyOtpForCustomer(customerId: string, otp: string, purpose?: string, phoneNumber?: string) {
    if (!otp || otp.trim() === '') {
      throw new BadRequestException('PIN incorrecto');
    }

    const client = this.supabaseService.getAdminClient();
    if (!client) {
      // Modo dev: aceptar siempre para no bloquear
      const verificationToken = this.jwtService.sign(
        { sub: customerId, purpose: purpose || 'verification', type: 'verification' },
        { expiresIn: '10m' }
      );
      return { verified: true, token: verificationToken, expiresIn: 600 };
    }

    let userIdToCheck = customerId;
    
    if (phoneNumber) {
      const variants = this.normalizePhone(phoneNumber);
      if (!variants || variants.length === 0) {
        throw new BadRequestException('PIN incorrecto');
      }
      const { data: userByPhone, error: phoneError } = await client
        .from('app_users')
        .select('id')
        .in('phone_number', variants)
        .maybeSingle();
      if (phoneError) {
        throw new BadRequestException('Error al buscar cliente por teléfono');
    }
      if (!userByPhone?.id) {
        throw new NotFoundException('Cliente no encontrado');
      }
      userIdToCheck = userByPhone.id;
    }

    const { data: user, error } = await client
      .from('app_users')
      .select('id, pin, password_salt')
      .eq('id', userIdToCheck)
      .single();

    if (error || !user) {
      throw new NotFoundException('Cliente no encontrado');
    }

    if (!user.pin) {
      throw new BadRequestException('PIN incorrecto');
    }

    const pinWithSalt = otp + (user.password_salt || '');
    const hashedPin = crypto.createHash('sha1').update(pinWithSalt).digest('hex');
    
    if (hashedPin.toLowerCase() !== user.pin.toLowerCase()) {
      throw new BadRequestException('PIN incorrecto');
    }

    // Generar token de verificación válido por 10 minutos
    const verificationToken = this.jwtService.sign(
      { 
        sub: user.id, 
        purpose: purpose || 'verification',
        type: 'verification'
      },
      { expiresIn: '10m' }
    );

    return {
      verified: true,
      token: verificationToken,
      expiresIn: 600
    };
  }

  // ========== ATENCIÓN A CLIENTES ==========

  async getCustomerInfo(customerId: string) {
    const customer = await this.getCustomerById(customerId);
    
    return {
      ...customer,
      registrationDate: customer.created_at?.split('T')[0] || null
    };
  }

  async getCustomerBalance(customerId: string) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    const balance = await this.balanceService.getUserBalance(customerId);
    
    // Obtener inversiones activas
    const { data: investments } = await this.supabaseService.getAdminClient()
      .from('investments')
      .select('amount, returns')
      .eq('user_id', customerId)
      .eq('status', 'active');

    const investedBalance = investments?.reduce((sum, inv) => sum + (inv.amount || 0), 0) || 0;
    const availableReturns = investments?.reduce((sum, inv) => sum + (inv.returns || 0), 0) || 0;
    
    // Obtener total de rendimientos históricos
    const { data: allInvestments } = await this.supabaseService.getAdminClient()
      .from('investments')
      .select('returns')
      .eq('user_id', customerId);

    const totalReturns = allInvestments?.reduce((sum, inv) => sum + (inv.returns || 0), 0) || 0;

    return {
      totalBalance: balance.total_balance,
      availableBalance: balance.available_balance,
      investedBalance,
      availableReturns,
      totalReturns,
      currency: 'MXN',
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Acredita manualmente los rendimientos generados de una inversión vencida.
   * Usa addBalance para actualizar total_balance (fuente de verdad).
   */
  async creditInvestmentReturns(customerId: string, investmentId: string) {
    const client = this.supabaseService.getAdminClient();
    if (!client) throw new Error('No Supabase client available');

    // Obtener la inversión
    const { data: inv, error } = await client
      .from('investments')
      .select('id, amount, interest_rate, term, status, maturity_date, returns_credited')
      .eq('id', investmentId)
      .eq('user_id', customerId)
      .single();

    if (error || !inv) throw new Error('Inversión no encontrada');

    // Solo procesar inversiones vencidas
    const now = new Date();
    const maturityDate = inv.maturity_date ? new Date(inv.maturity_date) : null;
    const isMatured =
      inv.status === 'matured' ||
      (maturityDate && maturityDate < now);

    if (!isMatured) throw new Error('La inversión no ha vencido aún');

    // Verificar si ya se acreditaron los rendimientos
    if (inv.returns_credited) {
      throw new Error('Los rendimientos ya fueron acreditados anteriormente');
    }

    // Calcular rendimientos: principal × tasa × (plazo / 12)
    const principal = Number(inv.amount ?? 0);
    let rate = Number(inv.interest_rate ?? 0);
    if (rate >= 1) rate = rate / 100; // normalizar a decimal si viene como porcentaje
    const termMonths = Number(inv.term ?? 0);
    // Interés compuesto mensual: principal × ((1 + tasa/12)^meses - 1)
    const earnings = Math.round(principal * (Math.pow(1 + rate / 12, termMonths) - 1) * 100) / 100;

    if (earnings <= 0) throw new Error('Los rendimientos calculados son 0 o negativos');

    // Acreditar al balance del usuario
    await this.balanceService.addBalance(
      customerId,
      earnings,
      `RETURNS-${investmentId}`,
      `Rendimientos inversión vencida $${principal.toFixed(2)} × ${(rate * 100).toFixed(2)}% × ${termMonths}m`,
    );

    // Marcar la inversión como rendimientos acreditados (si la columna existe)
    await client
      .from('investments')
      .update({ returns_credited: true, total_earnings: earnings })
      .eq('id', investmentId);

    return {
      investmentId,
      principal,
      rate: rate * 100,
      termMonths,
      earnings,
      message: `Se acreditaron $${earnings.toFixed(2)} MXN al usuario`,
    };
  }

  async getCustomerInvestments(customerId: string, filters: {
    startDate?: string;
    endDate?: string;
    status?: string;
  }) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    let query = this.supabaseService.getAdminClient()
      .from('investments')
      .select('*')
      .eq('user_id', customerId);

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data: investments, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Error al obtener inversiones: ${error.message}`);
    }

    return investments?.map(inv => {
      // Term: prefer term, fallback term_months
      const termValue = inv.term ?? inv.term_months ?? 0;
      // Interest: normalize to percentage (DB stores decimal)
      const rawRate = Number(inv.interest_rate ?? 0);
      const interestRatePct = rawRate < 1 ? rawRate * 100 : rawRate;

      return {
      id: inv.id,
      amount: inv.amount,
      date: inv.created_at?.split('T')[0] || null,
        term: `${termValue} meses`,
      status: inv.status,
      returns: inv.returns || 0,
        interestRate: interestRatePct,
      maturityDate: inv.maturity_date || null,
      created_at: inv.created_at,
      updated_at: inv.updated_at
      };
    }) || [];
  }

  // ==================== REPORTES CSV ====================
  private throwCsvValidationError(message: string): never {
    throw new BadRequestException({
      message,
      error: 'VALIDATION_ERROR',
      statusCode: 400,
    });
  }

  private throwCsvNotFound(message: string): never {
    throw new NotFoundException({
      message,
      error: 'NOT_FOUND',
      statusCode: 404,
    });
  }

  private validateCsvDateString(dateStr: string) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr) || Number.isNaN(Date.parse(`${dateStr}T12:00:00`))) {
      this.throwCsvValidationError('El formato de fecha debe ser YYYY-MM-DD');
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

  private todayMexicoDateString(): string {
    return this.formatMexicoDate(new Date()).split(' ')[0];
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

  private mapExternalTransferStatus(status?: string): string {
    if (status === 'pending') return 'Pendiente';
    return 'Completado';
  }

  private formatPhone10(phone?: string | null): string {
    if (!phone) return '';
    return String(phone).replace(/\D/g, '').slice(-10);
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

  private async resolveCsvDateRange(
    client: any,
    startDate?: string,
    endDate?: string,
    earliestSource: 'transactions' | 'external_transfers' = 'transactions',
    transactionTypes?: string[],
  ): Promise<{ start: string; end: string }> {
    const todayMexico = this.todayMexicoDateString();
    let start = startDate?.trim() || undefined;
    let end = endDate?.trim() || undefined;

    if (start) this.validateCsvDateString(start);
    if (end) this.validateCsvDateString(end);

    if (start && !end) {
      end = todayMexico;
    } else if (!start && end) {
      start = await this.getEarliestRecordDate(client, earliestSource, transactionTypes);
    }

    if (start && end && end < start) {
      this.throwCsvValidationError('La fecha de fin debe ser posterior o igual a la fecha de inicio');
    }

    if (!start) start = '1900-01-01';
    if (!end) end = todayMexico;

    return { start, end };
  }

  private async getEarliestRecordDate(
    client: any,
    table: 'transactions' | 'external_transfers',
    transactionTypes?: string[],
  ): Promise<string> {
    let query = client
      .from(table)
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1);

    if (table === 'transactions' && transactionTypes?.length) {
      query = query.in('type', transactionTypes);
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data?.created_at) {
      return '1900-01-01';
    }
    return this.formatMexicoDate(data.created_at).split(' ')[0];
  }

  private async validateBranchIfProvided(client: any, branchId?: string) {
    if (!branchId) return null;

    const { data: branch, error: branchError } = await client
      .from('branches')
      .select('id, name')
      .eq('id', branchId)
      .maybeSingle();

    if (branchError || !branch) {
      this.throwCsvNotFound('Sucursal no encontrada');
    }

    return branch.name as string;
  }

  private getTransactionTypesForReport(reportType: 'all' | 'abonos' | 'pagos'): string[] | undefined {
    if (reportType === 'abonos') return ['deposit'];
    if (reportType === 'pagos') return ['payment', 'withdrawal'];
    return undefined;
  }

  async generateCsvReport(options: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
    includePhone: boolean;
    reportType?: 'all' | 'abonos' | 'pagos';
  }) {
    return this.generateTransactionsCsvReport({
      ...options,
      reportType: options.reportType ?? 'all',
    });
  }

  async generateAbonosCsvReport(options: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
    includePhone: boolean;
  }) {
    return this.generateTransactionsCsvReport({ ...options, reportType: 'abonos' });
  }

  async generatePagosCsvReport(options: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
    includePhone: boolean;
  }) {
    return this.generateTransactionsCsvReport({ ...options, reportType: 'pagos' });
  }

  async generateTransferenciasCsvReport(options: {
    startDate?: string;
    endDate?: string;
    includePhone: boolean;
  }) {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new InternalServerErrorException({
        message: 'Error al generar el reporte CSV',
        error: 'INTERNAL_SERVER_ERROR',
        statusCode: 500,
      });
    }

    const { start, end } = await this.resolveCsvDateRange(
      client,
      options.startDate,
      options.endDate,
      'external_transfers',
    );

    let query = client
      .from('external_transfers')
      .select(`
        id,
        beneficiary_name,
        bank_name,
        clabe,
        amount,
        reference,
        status,
        created_at,
        user:app_users!external_transfers_user_id_fkey(first_name, last_name, phone_number)
      `)
      .order('created_at', { ascending: false })
      .gte('created_at', `${start}T00:00:00.000Z`)
      .lte('created_at', `${end}T23:59:59.999Z`);

    const { data, error } = await query;
    if (error) {
      throw new InternalServerErrorException({
        message: 'Error al generar el reporte CSV',
        error: 'INTERNAL_SERVER_ERROR',
        statusCode: 500,
      });
    }

    const rows: string[][] = [];
    if (options.includePhone) {
      rows.push([
        'Referencia',
        'Monto',
        'Emisor',
        'Teléfono emisor',
        'Beneficiario',
        'Banco',
        'CLABE',
        'Estado',
        'Fecha (México)',
      ]);
    } else {
      rows.push([
        'Referencia',
        'Monto',
        'Emisor',
        'Beneficiario',
        'Banco',
        'CLABE',
        'Estado',
        'Fecha (México)',
      ]);
    }

    for (const transfer of data || []) {
      const userNode = Array.isArray(transfer.user) ? transfer.user[0] : transfer.user;
      const emitterName = userNode
        ? `${userNode.first_name || ''} ${userNode.last_name || ''}`.trim()
        : '';
      const phone = this.formatPhone10(userNode?.phone_number);
      const rowBase = [
        transfer.reference || '',
        Number(transfer.amount ?? 0).toFixed(2),
        emitterName,
        transfer.beneficiary_name || '',
        transfer.bank_name || '',
        transfer.clabe || '',
        this.mapExternalTransferStatus(transfer.status),
        this.formatMexicoDate(transfer.created_at),
      ];

      if (options.includePhone) {
        rows.push([
          rowBase[0],
          rowBase[1],
          rowBase[2],
          phone,
          rowBase[3],
          rowBase[4],
          rowBase[5],
          rowBase[6],
          rowBase[7],
        ]);
      } else {
        rows.push(rowBase);
      }
    }

    return this.buildCsv(rows);
  }

  logCsvReportDownload(meta: {
    adminId?: string;
    report: string;
    includePhone: boolean;
    branchId?: string;
    startDate?: string;
    endDate?: string;
  }) {
  }

  private async generateTransactionsCsvReport(options: {
    branchId?: string;
    startDate?: string;
    endDate?: string;
    includePhone: boolean;
    reportType: 'all' | 'abonos' | 'pagos';
  }) {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new InternalServerErrorException({
        message: 'Error al generar el reporte CSV',
        error: 'INTERNAL_SERVER_ERROR',
        statusCode: 500,
      });
    }

    const transactionTypes = this.getTransactionTypesForReport(options.reportType);
    const { start, end } = await this.resolveCsvDateRange(
      client,
      options.startDate,
      options.endDate,
      'transactions',
      transactionTypes,
    );

    const branchName = await this.validateBranchIfProvided(client, options.branchId);

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
        branch:branches!transactions_branch_id_fkey(name, id),
        user_from:app_users!transactions_user_id_fkey(phone_number)
      `)
      .order('created_at', { ascending: false })
      .gte('created_at', `${start}T00:00:00.000Z`)
      .lte('created_at', `${end}T23:59:59.999Z`);

    if (options.branchId) {
      query = query.eq('branch_id', options.branchId);
    }

    if (transactionTypes?.length) {
      query = query.in('type', transactionTypes);
    }

    const { data, error } = await query;
    if (error) {
      throw new InternalServerErrorException({
        message: 'Error al generar el reporte CSV',
        error: 'INTERNAL_SERVER_ERROR',
        statusCode: 500,
      });
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

      const phone = this.formatPhone10(userNode?.phone_number);
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

  async getCustomerPurchases(customerId: string, filters: {
    startDate?: string;
    endDate?: string;
    type?: string;
  }) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    let query = this.supabaseService.getAdminClient()
      .from('transactions')
      .select('*')
      .eq('user_id', customerId)
      .in('type', ['payment', 'transfer_sent']);

    if (filters.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    const { data: transactions, error } = await query.order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Error al obtener compras: ${error.message}`);
    }

    return transactions?.map(t => ({
      id: t.id,
      amount: Math.abs(t.amount || 0),
      date: t.created_at?.split('T')[0] || null,
      description: t.description || 'Compra',
      type: t.type === 'payment' ? 'available_balance' : 'available_balance',
      currency: 'MXN',
      created_at: t.created_at
    })) || [];
  }

  // ========== SEGUROS ==========

  async getInsuranceRequests(filters: {
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
  }) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    const page = filters.page || 1;
    const limit = filters.limit || 50;
    const offset = (page - 1) * limit;

    // Join with app_users to get customer information
    let query = this.supabaseService.getAdminClient()
      .from('insurance_contracts')
      .select(`
        *,
        app_users:user_id(
          id,
          first_name,
          last_name,
          phone_number,
          email,
          date_of_birth,
          rfc,
          curp,
          gender
        )
      `, { count: 'exact' });

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.search) {
      query = query.or(`app_users.first_name.ilike.%${filters.search}%,app_users.last_name.ilike.%${filters.search}%,app_users.phone_number.ilike.%${filters.search}%,app_users.email.ilike.%${filters.search}%,app_users.rfc.ilike.%${filters.search}%,app_users.curp.ilike.%${filters.search}%`);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new BadRequestException(`Error al obtener solicitudes: ${error.message}`);
    }

    return {
      data: data?.map(contract => {
        const user = contract.app_users;
        const beneficiary = Array.isArray(contract.beneficiaries) && contract.beneficiaries.length > 0 
          ? contract.beneficiaries[0] 
          : null;
        const fullName = beneficiary?.name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || null;
        // Obtener sexo desde beneficiaries, si no está, desde user
        const sexo = beneficiary?.gender 
          ? (beneficiary.gender === 'Masculino' ? 'M' : beneficiary.gender === 'Femenino' ? 'F' : null)
          : (user?.gender === 'male' ? 'M' : user?.gender === 'female' ? 'F' : null);
        return {
          id: contract.id,
          fechaContratacion: contract.start_date || contract.created_at?.split('T')[0],
          telefono: beneficiary?.phone || user?.phone_number || null,
          email: beneficiary?.email || user?.email || null,
          nombreCompleto: fullName,
          fechaNacimiento: beneficiary?.birthDate || user?.date_of_birth || null,
          rfc: beneficiary?.rfc || user?.rfc || null,
          curp: beneficiary?.curp || user?.curp || null,
          sexo,
          status: contract.status || 'Pendiente',
          beneficiario: beneficiary?.name || 'N/A',
          beneficiarioTelefono: beneficiary?.phone || null,
          beneficiarioEmail: beneficiary?.email || null,
          tipoSeguro: contract.coverage_type || contract.plan_type || null,
          plazo: contract.payment_frequency || null,
          monto: contract.coverage_amount ?? contract.monthly_premium ?? contract.annual_premium ?? null,
          created_at: contract.created_at,
          updated_at: contract.updated_at
        };
      }) || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    };
  }

  async getInsuranceRequestById(requestId: string) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    // Join with app_users to get customer information
    const { data, error } = await this.supabaseService.getAdminClient()
      .from('insurance_contracts')
      .select(`
        *,
        app_users:user_id(
          id,
          first_name,
          last_name,
          phone_number,
          email,
          date_of_birth,
          rfc,
          curp,
          gender
        )
      `)
      .eq('id', requestId)
      .single();

    if (error || !data) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    const user = data.app_users;
    const beneficiary = Array.isArray(data.beneficiaries) && data.beneficiaries.length > 0 
      ? data.beneficiaries[0] 
      : null;
    
    // Extraer nombre y apellidos desde el nombre completo del beneficiario o desde user
    let nombre = null;
    let apellidoPaterno = null;
    let apellidoMaterno = null;
    
    if (beneficiary?.name) {
      const nameParts = beneficiary.name.trim().split(' ');
      nombre = nameParts[0] || null;
      apellidoPaterno = nameParts[1] || null;
      apellidoMaterno = nameParts[2] || null;
    } else {
      nombre = user?.first_name || null;
      apellidoPaterno = user?.last_name || null;
      apellidoMaterno = null;
    }

    // Obtener sexo desde beneficiaries, si no está, desde user
    const sexo = beneficiary?.gender 
      ? (beneficiary.gender === 'Masculino' ? 'M' : beneficiary.gender === 'Femenino' ? 'F' : null)
      : (user?.gender === 'male' ? 'M' : user?.gender === 'female' ? 'F' : null);

    return {
      id: data.id,
      fechaContratacion: data.start_date || data.created_at?.split('T')[0],
      telefono: beneficiary?.phone || user?.phone_number || null,
      email: beneficiary?.email || user?.email || null,
      nombre,
      apellidoPaterno,
      apellidoMaterno,
      fechaNacimiento: beneficiary?.birthDate || user?.date_of_birth || null,
      rfc: beneficiary?.rfc || user?.rfc || null,
      curp: beneficiary?.curp || user?.curp || null,
      sexo,
      status: data.status || 'Pendiente',
      notes: data.notes || null,
      approvedBy: null, // Not in current schema - would need migration
      approvedAt: null, // Not in current schema - would need migration
      rejectedReason: null, // Not in current schema - would need migration
      created_at: data.created_at,
      updated_at: data.updated_at
    };
  }

  async updateInsuranceRequestStatus(
    requestId: string,
    adminId: string,
    updateData: {
      status: string;
      notes?: string;
      rejectedReason?: string;
      individualPolicyNumber?: string;
    }
  ) {
    if (!['Aprobado', 'Rechazado', 'En Proceso'].includes(updateData.status)) {
      throw new BadRequestException('Estado inválido');
    }

    if (updateData.status === 'Rechazado' && !updateData.rejectedReason) {
      throw new BadRequestException('El motivo de rechazo es requerido cuando el estado es Rechazado');
    }

    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    const updatePayload: any = {
      status: updateData.status,
      updated_at: new Date().toISOString()
    };

    // Si se proporciona el número de póliza individual, agregarlo
    if (updateData.individualPolicyNumber !== undefined) {
      updatePayload.individual_policy_number = updateData.individualPolicyNumber || null;
    }

    if (updateData.notes) {
      updatePayload.notes = updateData.notes;
    }

    // Note: approved_by, approved_at, rejected_reason are not in current schema
    // These would need to be added via migration if required
    // For now, we'll store this information in the notes field
    if (updateData.status === 'Aprobado' || updateData.status === 'Rechazado') {
      const adminNote = `[${updateData.status}] Por admin ${adminId} el ${new Date().toISOString()}`;
      updatePayload.notes = updateData.notes 
        ? `${updateData.notes}\n${adminNote}`
        : adminNote;
    }

    if (updateData.status === 'Rechazado' && updateData.rejectedReason) {
      const rejectionNote = `Motivo de rechazo: ${updateData.rejectedReason}`;
      updatePayload.notes = updateData.notes 
        ? `${updateData.notes}\n${rejectionNote}`
        : rejectionNote;
    }

    const { data, error } = await this.supabaseService.getAdminClient()
      .from('insurance_contracts')
      .update(updatePayload)
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(`Error al actualizar estado: ${error.message}`);
    }

    if (!data) {
      throw new NotFoundException('Solicitud no encontrada');
    }

    return {
      id: data.id,
      status: data.status,
      notes: data.notes || null,
      approvedBy: null, // Not in current schema
      approvedAt: null, // Not in current schema
      rejectedReason: null, // Not in current schema (would need to parse from notes)
      updated_at: data.updated_at
    };
  }

  // ========== TASAS DE INTERÉS ==========

  async getInvestmentRates() {
    return this.investmentRatesService.getRates();
  }

  async upsertInvestmentRate(dto: CreateInvestmentRateDto, adminId?: string, notes?: string) {
    return this.investmentRatesService.upsertRate(dto, adminId, notes);
  }

  /**
   * Obtiene la CLABE de un usuario (solo admin)
   */
  async getUserClabe(userId: string): Promise<{ clabe: string | null }> {
    // Verificar que el usuario existe
    const user = await this.supabaseService.getUser(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return { clabe: user.clabe || null };
  }

  /**
   * Actualiza la CLABE de un usuario (solo admin)
   */
  async updateUserClabe(userId: string, clabe: string): Promise<{ message: string; clabe: string }> {
    // Validar formato de CLABE (18 dígitos)
    if (!clabe || clabe.length !== 18 || !/^\d+$/.test(clabe)) {
      throw new BadRequestException('La CLABE debe tener exactamente 18 dígitos numéricos');
    }

    // Verificar que el usuario existe
    const user = await this.supabaseService.getUser(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Actualizar CLABE
    const { data, error } = await this.supabaseService.getAdminClient()
      .from('app_users')
      .update({ clabe })
      .eq('id', userId)
      .select('clabe')
      .single();

    if (error) {
      throw new BadRequestException(`Error al actualizar CLABE: ${error.message}`);
    }

    return {
      message: 'CLABE actualizada exitosamente',
      clabe: data.clabe,
    };
  }
}
