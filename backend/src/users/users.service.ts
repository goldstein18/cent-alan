import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ChangePasswordDto, ChangePinDto, UpdateUserDto } from '../types/user';

@Injectable()
export class UsersService {
  constructor(
    private supabaseService: SupabaseService,
    private notificationsService: NotificationsService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.supabaseService.getUser(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    // Remover PIN del objeto de respuesta
    const { pin, ...userWithoutPin } = user;
    return userWithoutPin;
  }

  async updateProfile(userId: string, updateUserDto: UpdateUserDto) {
    const user = await this.supabaseService.updateUser(userId, updateUserDto);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    // Remover PIN del objeto de respuesta
    const { pin, ...userWithoutPin } = user;
    return userWithoutPin;
  }

  async changePin(userId: string, changePinDto: ChangePinDto) {
    const user = await this.supabaseService.getUser(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Si se proporciona el PIN actual, verificarlo
    // Si no se proporciona (viene vacío, null o undefined), permitir cambiar sin verificación (usuario ya autenticado)
    const hasCurrentPin = changePinDto.currentPin && 
                          typeof changePinDto.currentPin === 'string' && 
                          changePinDto.currentPin.trim().length > 0;
    
    if (hasCurrentPin) {
      // Verificar PIN actual usando SHA1 con salt (mismo algoritmo que login)
      const pinWithSalt = changePinDto.currentPin.trim() + (user.password_salt || '');
      const hashedCurrentPin = crypto.createHash('sha1').update(pinWithSalt).digest('hex');
      
      if (hashedCurrentPin.toLowerCase() !== user.pin.toLowerCase()) {
        throw new BadRequestException('PIN actual incorrecto');
      }
    }
    // Si no hay PIN actual, continuar sin verificación (usuario autenticado con JWT)

    // Hashear nuevo PIN usando SHA1 con el mismo salt
    const newPinWithSalt = changePinDto.newPin + (user.password_salt || '');
    const hashedNewPin = crypto.createHash('sha1').update(newPinWithSalt).digest('hex');

    // Actualizar PIN
    try {
      await this.supabaseService.updateUser(userId, { pin: hashedNewPin });
    } catch (error) {
      console.error('Error updating PIN:', error);
      throw new BadRequestException('Error al actualizar el PIN. Por favor intenta de nuevo.');
    }

    // Notificar cambio de PIN (fire-and-forget, errors handled internally)
    this.notificationsService.notifyPinChanged(userId);

    return { message: 'PIN actualizado exitosamente' };
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.supabaseService.getUser(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (!changePasswordDto.currentPassword || !changePasswordDto.newPassword) {
      throw new BadRequestException('La contraseña actual y la nueva son requeridas');
    }

    if (changePasswordDto.newPassword.length < 6) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 6 caracteres');
    }

    const salt = user.password_salt || '';
    const storedPasswordHash = this.normalizeHash(user.password || user.pin);
    if (!storedPasswordHash) {
      throw new BadRequestException('No se encontró contraseña configurada para este usuario');
    }

    const currentPassword = changePasswordDto.currentPassword;
    const matchesCurrentPassword = this.verifyLegacyPassword(
      currentPassword,
      storedPasswordHash,
      salt,
    );

    if (!matchesCurrentPassword) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    const newPasswordHash = crypto.createHash('sha1').update(changePasswordDto.newPassword + salt).digest('hex');

    try {
      const adminClient = this.supabaseService.getAdminClient();
      if (!adminClient) {
        throw new BadRequestException('No hay cliente de administración disponible para actualizar contraseña');
      }

      const { error: appUsersError } = await adminClient
        .from('app_users')
        .update({ password: newPasswordHash })
        .eq('id', userId);

      if (appUsersError) {
        throw new Error(`No se pudo actualizar app_users.password: ${appUsersError.message}`);
      }

      // Tabla legacy opcional; no bloquear si no existe/permite escritura
      const { error: usersTableError } = await adminClient
        .from('users')
        .update({ password: newPasswordHash })
        .eq('id', userId);
      if (usersTableError) {
        // Legacy table is optional.
      }

      // Verificación estricta: solo responder éxito si app_users quedó con el hash nuevo
      const { data: verifyUser, error: verifyError } = await adminClient
        .from('app_users')
        .select('password')
        .eq('id', userId)
        .single();

      if (verifyError) {
        throw new Error(`No se pudo verificar contraseña actualizada: ${verifyError.message}`);
      }

      const savedHash = this.normalizeHash(verifyUser?.password);
      if (!savedHash || savedHash !== newPasswordHash.toLowerCase()) {
        throw new Error('La contraseña no se persistió correctamente en app_users');
      }
    } catch (error) {
      console.error('Error updating password:', error);
      throw new BadRequestException('Error al actualizar la contraseña. Por favor intenta de nuevo.');
    }

    return { message: 'Contraseña actualizada exitosamente' };
  }

  async getReferralCode(userId: string) {
    const user = await this.supabaseService.getUser(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return {
      referralCode: user.referral_info?.code || 'N/A',
      totalReferrals: user.referral_info?.total_referrals || 0,
      commissionEarned: user.referral_info?.commission_earned || 0,
    };
  }

  /**
   * Actualiza la racha del usuario cuando abre la app
   * Retorna los días y semanas actuales
   */
  async updateStreak(userId: string): Promise<{ days: number; weeks: number }> {
    const user = await this.supabaseService.getUser(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    let currentStreak = user.streak_days || 0;
    const lastAppOpenDate = user.streak_last_app_open_date 
      ? new Date(user.streak_last_app_open_date).toISOString().split('T')[0]
      : null;

    // Si ya se abrió la app hoy, retornar valores actuales
    if (lastAppOpenDate === todayStr) {
      const weeks = Math.floor(currentStreak / 7);
      return { days: currentStreak, weeks };
    }

    // Calcular diferencia de días
    let daysDiff = 0;
    if (lastAppOpenDate) {
      const lastDate = new Date(lastAppOpenDate);
      lastDate.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - lastDate.getTime();
      daysDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    // Actualizar racha
    if (!lastAppOpenDate) {
      // Primera vez que se abre la app - iniciar racha en 1
      currentStreak = 1;
    } else if (daysDiff === 1) {
      // Día consecutivo - incrementar racha
      currentStreak += 1;
    } else if (daysDiff > 1) {
      // Se perdió la racha (pasó más de 1 día) - reiniciar a 1
      currentStreak = 1;
    } else if (daysDiff === 0) {
      // Mismo día (no debería llegar aquí porque ya se verifica arriba, pero por seguridad)
      // Mantener el valor actual sin cambios
    }

    // Guardar en Supabase
    await this.supabaseService.updateUser(userId, {
      streak_days: currentStreak,
      streak_last_app_open_date: todayStr,
    });

    const weeks = Math.floor(currentStreak / 7);
    return { days: currentStreak, weeks };
  }

  /**
   * Obtiene la racha actual del usuario sin actualizarla
   */
  async getStreak(userId: string): Promise<{ days: number; weeks: number }> {
    const user = await this.supabaseService.getUser(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const days = user.streak_days || 0;
    const weeks = Math.floor(days / 7);
    return { days, weeks };
  }

  /**
   * Obtiene la CLABE del usuario
   */
  async getClabe(userId: string): Promise<{ clabe: string | null }> {
    const user = await this.supabaseService.getUser(userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return { clabe: user.clabe || null };
  }

  private normalizeHash(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim().toLowerCase();
    return normalized.length > 0 ? normalized : null;
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
}
