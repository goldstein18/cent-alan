import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as twilio from 'twilio';

@Injectable()
export class PaymentOtpService {
  private twilioClient: twilio.Twilio;
  // Store OTPs for payments: phoneNumber -> { otp, expiresAt, userId }
  private paymentOtpStore: Map<string, { otp: string; expiresAt: number; userId: string }> = new Map();

  constructor(private configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const apiKeySid = this.configService.get<string>('TWILIO_API_KEY_SID');
    const apiKeySecret = this.configService.get<string>('TWILIO_API_KEY_SECRET');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    
    // Preferir API Keys sobre Auth Token (más seguro)
    if (accountSid && accountSid.startsWith('AC')) {
      if (apiKeySid && apiKeySecret && apiKeySid.startsWith('SK')) {
        // Usar API Keys (método recomendado)
        this.twilioClient = twilio(apiKeySid, apiKeySecret, { accountSid });
      } else if (authToken && authToken.length > 0) {
        // Fallback a Auth Token (método legacy)
        this.twilioClient = twilio(accountSid, authToken);
      }
    }
  }

  /**
   * Genera un OTP de 6 dígitos para pagos
   * Dura 2 minutos (120 segundos)
   */
  async generatePaymentOtp(userId: string, phoneNumber: string): Promise<{ success: boolean; otp?: string; messageId?: string }> {
    try {
      // Generar OTP de 6 dígitos
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Guardar OTP con expiración de 2 minutos
      const expiresAt = Date.now() + (2 * 60 * 1000);
      
      // Normalizar número de teléfono para almacenamiento
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      const phoneKey = normalizedPhone.length === 10 ? `52${normalizedPhone}` : normalizedPhone;
      
      this.paymentOtpStore.set(phoneKey, { otp, expiresAt, userId });

      // NO enviar SMS - el OTP se muestra en la app para que el usuario lo dicte al cajero
      
      return {
        success: true,
        otp, // Siempre retornar OTP para mostrarlo en la app
      };
    } catch (error) {
      console.error('Error generating payment OTP:', error);
      throw new Error('Error al generar código OTP de pago');
    }
  }

  /**
   * Verifica el OTP de pago
   * Retorna el userId si el OTP es válido, null si no lo es
   */
  async verifyPaymentOtp(phoneNumber: string, otp: string): Promise<{ valid: boolean; userId?: string }> {
    try {
      // Normalizar número de teléfono
      const normalizedPhone = phoneNumber.replace(/\D/g, '');
      const phoneKey = normalizedPhone.length === 10 ? `52${normalizedPhone}` : normalizedPhone;
      
      const storedOtp = this.paymentOtpStore.get(phoneKey);
      
      if (!storedOtp) {
        return { valid: false };
      }

      // Verificar expiración
      if (Date.now() > storedOtp.expiresAt) {
        this.paymentOtpStore.delete(phoneKey);
        return { valid: false };
      }

      // Verificar OTP
      if (storedOtp.otp !== otp) {
        return { valid: false };
      }

      // OTP válido, retornar userId y eliminar del store
      const userId = storedOtp.userId;
      this.paymentOtpStore.delete(phoneKey);
      return { valid: true, userId };
    } catch (error) {
      console.error('Error verifying payment OTP:', error);
      return { valid: false };
    }
  }

  /**
   * Limpiar OTPs expirados
   */
  cleanupExpiredOtps(): void {
    const now = Date.now();
    for (const [phoneKey, data] of this.paymentOtpStore.entries()) {
      if (now > data.expiresAt) {
        this.paymentOtpStore.delete(phoneKey);
      }
    }
  }
}

