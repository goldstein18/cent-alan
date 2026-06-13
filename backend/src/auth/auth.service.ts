import { BadRequestException, HttpException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { ReferralsService } from '../referrals/referrals.service';
import { SupabaseService } from '../supabase/supabase.service';
import { AuthResponse, JwtPayload, OtpResponse, ResetPasswordDto, SignupDto } from '../types/auth';
import { OtpService } from './otp.service';

@Injectable()
export class AuthService {
  constructor(
    private supabaseService: SupabaseService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private otpService: OtpService,
    private notificationsService: NotificationsService,
    private referralsService: ReferralsService,
  ) {}

  async sendOtp(phoneNumber: string, email?: string): Promise<OtpResponse> {
    try {
      // Validar formato de teléfono
      if (!this.isValidMexicanPhone(phoneNumber)) {
        throw new BadRequestException('Formato de teléfono inválido');
      }

      // Validar email solo si se proporcionó (signup lo manda, reset-password no)
      if (email && !this.isValidEmail(email)) {
        throw new BadRequestException('Formato de email inválido');
      }

      // Enviar OTP por SMS
      await this.otpService.sendOtp(phoneNumber);

      return {
        success: true,
        message: 'Código OTP enviado exitosamente',
        expiresIn: 300, // 5 minutos
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      // Propagar el mensaje específico del OTP service (ej. bloqueo de número)
      throw new BadRequestException(error.message || 'Error al enviar código OTP');
    }
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const cleanPhone = dto.phoneNumber.replace(/\D/g, '');

    // 1. Verificar OTP via Twilio
    const isOtpValid = await this.otpService.verifyOtp(cleanPhone, dto.otp);
    if (!isOtpValid) {
      throw new BadRequestException('Código OTP inválido o expirado');
    }

    // 2. Buscar usuario por teléfono
    const supabase = this.supabaseService.getAdminClient();
    if (!supabase) throw new BadRequestException('Servicio de base de datos no disponible');

    const phoneVariants: string[] = [cleanPhone];
    if (cleanPhone.length === 10) {
      phoneVariants.push(`52${cleanPhone}`, `+52${cleanPhone}`, `+521${cleanPhone}`);
    } else if (cleanPhone.length === 12 && cleanPhone.startsWith('52')) {
      const last10 = cleanPhone.slice(-10);
      phoneVariants.push(last10, `+52${last10}`);
    }

    let { data: users } = await supabase
      .from('app_users')
      .select('id, phone_number, password_salt, is_active')
      .in('phone_number', phoneVariants)
      .limit(1);

    if (!users || users.length === 0) {
      const last10 = cleanPhone.slice(-10);
      const fallback = await supabase
        .from('app_users')
        .select('id, phone_number, password_salt, is_active')
        .ilike('phone_number', `%${last10}`)
        .limit(1);
      if (fallback.data && fallback.data.length > 0) users = fallback.data;
    }

    if (!users || users.length === 0) {
      throw new NotFoundException('No se encontró una cuenta con ese número de teléfono');
    }

    const user = users[0];
    if (!user.is_active) {
      throw new BadRequestException('Cuenta desactivada');
    }

    if (!dto.newPassword || dto.newPassword.length < 6) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 6 caracteres');
    }

    // 3. Hashear nueva contraseña con el mismo algoritmo del signup
    const salt = user.password_salt || user.id;
    const newPasswordHash = crypto.createHash('sha1').update(dto.newPassword + salt).digest('hex');

    // 4. Actualizar contraseña
    const { error } = await supabase
      .from('app_users')
      .update({ password: newPasswordHash })
      .eq('id', user.id);

    if (error) {
      throw new BadRequestException('Error al actualizar la contraseña');
    }

    // Tabla legacy opcional
    await supabase.from('users').update({ password: newPasswordHash }).eq('id', user.id);

    return { message: 'Contraseña actualizada exitosamente' };
  }

  async verifyOtp(phoneNumber: string, otp: string): Promise<OtpResponse> {
    try {
      const isValid = await this.otpService.verifyOtp(phoneNumber, otp);

      if (!isValid) {
        throw new BadRequestException('Código OTP inválido o expirado');
      }

      return {
        success: true,
        message: 'Código OTP verificado exitosamente',
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException('Error al verificar código OTP');
    }
  }

  async login(phoneNumber: string, otp: string): Promise<AuthResponse> {
    try {
      // Verificar OTP
      const isOtpValid = await this.otpService.verifyOtp(phoneNumber, otp);
      if (!isOtpValid) {
        throw new UnauthorizedException('Código OTP inválido');
      }

      // Buscar usuario
      const user = await this.supabaseService.getUser(phoneNumber);
      if (!user) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      if (!user.is_active) {
        throw new UnauthorizedException('Cuenta desactivada');
      }

      try {
        const linked = await this.supabaseService.linkPosDepositsToUser(user.id, user.phone_number);
        for (const amount of linked.amounts) {
          this.notificationsService.notifyDeposit(user.id, amount);
        }
      } catch {
        // Non-blocking during login.
      }

      // Generar tokens
      const payload: JwtPayload = {
        sub: user.id,
        phoneNumber: user.phone_number,
      };

      const accessToken = this.jwtService.sign(payload, { expiresIn: '7d' });
      // Refresh token válido por 90 días para que el usuario no tenga que iniciar sesión constantemente
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '90d' });

      // Notificar nuevo inicio de sesión con delay para que el token push esté registrado
      // (la app registra el token ~1.5s después del login, el backend espera 5s)
      const loginUserId = user.id;
      setTimeout(() => {
        this.notificationsService.notifyNewLogin(loginUserId);
      }, 5000);

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          phoneNumber: user.phone_number,
          firstName: user.first_name,
          lastName: user.last_name,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Error en el proceso de login');
    }
  }

  async loginWithPassword(phoneNumber: string, password: string): Promise<AuthResponse> {
    try {
      // Limpiar número de teléfono (remover espacios, guiones, etc)
      const cleanPhone = phoneNumber.replace(/\D/g, '');

      // Buscar usuario por número de teléfono en Supabase
      // Usar admin client para bypassear RLS policies
      const supabase = this.supabaseService.getAdminClient();
      if (!supabase) {
        throw new BadRequestException('Servicio de base de datos no disponible');
      }

      // Generar variantes del número de teléfono para búsqueda más flexible
      const phoneVariants: string[] = [cleanPhone];
      if (cleanPhone.length === 10) {
        phoneVariants.push(`52${cleanPhone}`, `+52${cleanPhone}`, `+521${cleanPhone}`);
      } else if (cleanPhone.length === 12 && cleanPhone.startsWith('52')) {
        const last10 = cleanPhone.slice(-10);
        phoneVariants.push(last10, `+52${last10}`, `+521${last10}`);
      } else if (cleanPhone.length === 12 && cleanPhone.startsWith('521')) {
        const last10 = cleanPhone.slice(-10);
        phoneVariants.push(last10, `52${last10}`, `+52${last10}`);
      }

      // Buscar usuario en app_users usando variantes del teléfono
      let { data: users, error } = await supabase
        .from('app_users')
        .select('id, phone_number, first_name, last_name, pin, password, password_salt, is_active')
        .in('phone_number', phoneVariants)
        .limit(1);

      // Si no se encontró con variantes exactas, intentar búsqueda parcial como último recurso
      if ((error || !users || users.length === 0) && cleanPhone.length >= 10) {
        const last10Digits = cleanPhone.slice(-10);
        const fallbackResult = await supabase
          .from('app_users')
          .select('id, phone_number, first_name, last_name, pin, password, password_salt, is_active')
          .ilike('phone_number', `%${last10Digits}`)
          .limit(1);
        
        if (!fallbackResult.error && fallbackResult.data && fallbackResult.data.length > 0) {
          users = fallbackResult.data;
          error = null;
        }
      }

      if (error) {
        throw new UnauthorizedException('Error al buscar usuario');
      }

      if (!users || users.length === 0) {
        throw new UnauthorizedException('Credenciales inválidas');
      }

      const user = users[0];

      let userPassword = user.password;
      if (!userPassword) {
        const { data: usersTableData } = await supabase
          .from('users')
          .select('password')
          .eq('id', user.id)
          .maybeSingle();

        if (usersTableData?.password) {
          userPassword = usersTableData.password;
        }
      }

      let storedPasswordHash = userPassword || user.pin;
      if (storedPasswordHash) {
        storedPasswordHash = storedPasswordHash.trim().toLowerCase();
      }

      if (!user.is_active) {
        throw new UnauthorizedException('Cuenta desactivada');
      }

      try {
        const linked = await this.supabaseService.linkPosDepositsToUser(user.id, user.phone_number);
        for (const amount of linked.amounts) {
          this.notificationsService.notifyDeposit(user.id, amount);
        }
      } catch {
        // Non-blocking: login should succeed even if deposit linking fails.
      }

      if (!storedPasswordHash) {
        throw new UnauthorizedException('Usuario sin contraseña configurada. Contacta al administrador.');
      }

      const passwordMatches = this.verifyLegacyPassword(
        password,
        storedPasswordHash,
        user.password_salt || '',
      );

      if (!passwordMatches) {
        throw new UnauthorizedException('Credenciales inválidas');
      }

      // Generar tokens JWT
      const payload: JwtPayload = {
        sub: user.id,
        phoneNumber: user.phone_number,
      };

      const accessToken = this.jwtService.sign(payload, { expiresIn: '7d' });
      // Refresh token válido por 90 días para que el usuario no tenga que iniciar sesión constantemente
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '90d' });

      // Notificar nuevo inicio de sesión con delay para que el token push esté registrado
      // (la app registra el token ~1.5s después del login, el backend espera 5s)
      const pwLoginUserId = user.id;
      setTimeout(() => {
        this.notificationsService.notifyNewLogin(pwLoginUserId);
      }, 5000);

      return {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          phoneNumber: user.phone_number,
          firstName: user.first_name,
          lastName: user.last_name,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Error en el proceso de login');
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify(refreshToken);
      const user = await this.supabaseService.getUser(payload.sub);
      
      if (!user || !user.is_active) {
        throw new UnauthorizedException('Token de refresh inválido');
      }

      const newPayload: JwtPayload = {
        sub: user.id,
        phoneNumber: user.phone_number,
      };

      // Access token con expiración más larga (7 días) para evitar problemas de expiración inmediata
      const accessToken = this.jwtService.sign(newPayload, { expiresIn: '7d' });
      // Refresh token válido por 90 días para que el usuario no tenga que iniciar sesión constantemente
      const newRefreshToken = this.jwtService.sign(newPayload, { expiresIn: '90d' });

      return {
        accessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user.id,
          phoneNumber: user.phone_number,
          firstName: user.first_name,
          lastName: user.last_name,
        },
      };
    } catch {
      throw new UnauthorizedException('Token de refresh inválido');
    }
  }

  async logout(userId: string): Promise<{ message: string }> {
    // En una implementación real, podrías invalidar el token
    // Por ahora, solo retornamos un mensaje de éxito
    return { message: 'Logout exitoso' };
  }

  async getProfile(userId: string) {
    const user = await this.supabaseService.getUser(userId);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }
    // Remover PIN del objeto de respuesta
    const { pin, ...userWithoutPin } = user;
    return userWithoutPin;
  }

  private isValidMexicanPhone(phoneNumber: string): boolean {
    // Aceptar números mexicanos (10 dígitos) e internacionales (7-15 dígitos con o sin +)
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    return cleanPhone.length >= 7 && cleanPhone.length <= 15;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private verifyLegacyPassword(password: string, storedHash: string, passwordSalt: string): boolean {
    const candidates = [
      crypto.createHash('sha1').update(password + passwordSalt).digest('hex'),
      this.hashWithLegacyBinaryUuidSalt(password, passwordSalt),
      crypto.createHash('sha1').update(password).digest('hex'),
    ].filter((hash): hash is string => Boolean(hash));

    return candidates.some((hash) => hash.toLowerCase() === storedHash);
  }

  private hashWithLegacyBinaryUuidSalt(password: string, passwordSalt: string): string | null {
    if (!passwordSalt) return null;
    const uuidHex = passwordSalt.replace(/-/g, '');
    if (!/^[0-9a-fA-F]{32}$/.test(uuidHex)) {
      return null;
    }

    const passwordBuffer = Buffer.from(password, 'utf8');
    const uuidBytes = Buffer.from(uuidHex, 'hex');
    return crypto.createHash('sha1').update(Buffer.concat([passwordBuffer, uuidBytes])).digest('hex');
  }

  async validateUser(phoneNumber: string, otp: string): Promise<any> {
    const isOtpValid = await this.otpService.verifyOtp(phoneNumber, otp);
    if (!isOtpValid) {
      return null;
    }

    const user = await this.supabaseService.getUser(phoneNumber);
    if (!user || !user.is_active) {
      return null;
    }

    return {
      id: user.id,
      phoneNumber: user.phone_number,
      firstName: user.first_name,
      lastName: user.last_name,
    };
  }

  async signup(signupDto: SignupDto): Promise<AuthResponse> {
    try {
      const cleanPhone = signupDto.phoneNumber.replace(/\D/g, '');

      // 1. Verificar que el OTP fue validado
      const isOtpValid = await this.otpService.verifyOtp(cleanPhone, signupDto.otp);
      if (!isOtpValid) {
        throw new BadRequestException('Código OTP inválido o expirado. Por favor, verifica tu número de teléfono nuevamente.');
      }

      // 2. Verificar que el usuario no exista
      const existingUser = await this.supabaseService.getUser(cleanPhone);
      if (existingUser) {
        throw new BadRequestException('Este número de teléfono ya está registrado');
      }

      // 3. Generar password_salt (usar UUID o ID del usuario)
      // El salt se genera antes de crear el usuario, usaremos un UUID temporal
      const tempId = crypto.randomUUID();
      const passwordSalt = tempId; // El salt será el ID del usuario

      // 4. Hashear contraseña usando SHA1 con salt
      const passwordWithSalt = signupDto.password + passwordSalt;
      const hashedPassword = crypto.createHash('sha1').update(passwordWithSalt).digest('hex');

      // 5. Inicializar PIN en modo "pending setup"
      // El usuario debe crear su PIN en la app después del registro.
      const pendingPinSeed = `PIN_PENDING_SETUP:${passwordSalt}`;
      const hashedPin = crypto.createHash('sha1').update(pendingPinSeed).digest('hex');

      // 6. Preparar datos del usuario
      const userData = {
        phone_number: cleanPhone,
        email: signupDto.email.toLowerCase().trim(),
        first_name: signupDto.firstName.trim(),
        last_name: signupDto.lastName.trim(),
        second_last_name: signupDto.secondLastName?.trim() || null,
        birth_date: signupDto.birthDate,
        gender: signupDto.gender,
        street: signupDto.street.trim(),
        exterior_number: signupDto.exteriorNumber.trim(),
        interior_number: signupDto.interiorNumber?.trim() || null,
        neighborhood: signupDto.neighborhood.trim(),
        postal_code: signupDto.postalCode.trim(),
        city: signupDto.city.trim(),
        state: signupDto.state.trim(),
        password: hashedPassword,
        password_salt: passwordSalt,
        pin: hashedPin,
        is_active: true,
        referred_by: signupDto.referredBy || null,
      };

      // 7. Crear usuario
      const newUser = await this.supabaseService.createUser(userData);

      // 8. Actualizar password_salt con el ID real del usuario (si es diferente)
      if (newUser.id !== passwordSalt) {
        const updatedSalt = newUser.id;
        const updatedPasswordWithSalt = signupDto.password + updatedSalt;
        const updatedHashedPassword = crypto.createHash('sha1').update(updatedPasswordWithSalt).digest('hex');
        const updatedPendingPinSeed = `PIN_PENDING_SETUP:${updatedSalt}`;
        const updatedHashedPin = crypto.createHash('sha1').update(updatedPendingPinSeed).digest('hex');
        
        await this.supabaseService.updateUser(newUser.id, {
          password: updatedHashedPassword,
          password_salt: updatedSalt,
          pin: updatedHashedPin,
        });
      }

      // 9. Procesar código de referido si viene uno (fire-and-forget, no bloquea signup)
      if (signupDto.referredBy) {
        this.referralsService.processSignupReferral(newUser.id, signupDto.referredBy).catch(() => {});
      }

      // 10. Generar tokens JWT
      const payload: JwtPayload = {
        sub: newUser.id,
        phoneNumber: cleanPhone,
      };

      const accessToken = this.jwtService.sign(payload, { expiresIn: '7d' });
      const refreshToken = this.jwtService.sign(payload, { expiresIn: '90d' });

      return {
        accessToken,
        refreshToken,
        user: {
          id: newUser.id,
          phoneNumber: cleanPhone,
          firstName: signupDto.firstName,
          lastName: signupDto.lastName,
        },
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('Error en signup:', error);
      throw new BadRequestException('Error al crear la cuenta. Por favor, intenta de nuevo.');
    }
  }
}
