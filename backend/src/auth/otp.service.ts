import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as twilio from 'twilio';

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);
  private twilioClient: twilio.Twilio;
  private verifySid: string | null = null;
  private otpStore: Map<string, { otp: string; expiresAt: number }> = new Map();

  constructor(private configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const apiKeySid = this.configService.get<string>('TWILIO_API_KEY_SID');
    const apiKeySecret = this.configService.get<string>('TWILIO_API_KEY_SECRET');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const verifySid = this.configService.get<string>('TWILIO_VERIFY_SERVICE_SID');

    if (accountSid?.startsWith('AC')) {
      if (apiKeySid?.startsWith('SK') && apiKeySecret) {
        this.twilioClient = twilio(apiKeySid, apiKeySecret, { accountSid });
      } else if (authToken) {
        this.twilioClient = twilio(accountSid, authToken);
      }
    }

    if (verifySid?.startsWith('VA')) {
      this.verifySid = verifySid;
    }
  }

  private formatPhone(phoneNumber: string): string {
    if (phoneNumber.startsWith('+')) return phoneNumber;
    const digits = phoneNumber.replace(/\D/g, '');
    if (digits.length === 10) return `+52${digits}`;
    if (digits.length === 12 && digits.startsWith('52')) return `+${digits}`;
    return `+52${digits}`;
  }

  async sendOtp(phoneNumber: string): Promise<{ success: boolean; messageId?: string }> {
    const formattedPhone = this.formatPhone(phoneNumber);

    if (this.twilioClient && this.verifySid) {
      const verification = await this.twilioClient.verify.v2
        .services(this.verifySid)
        .verifications.create({ to: formattedPhone, channel: 'sms' });

      return { success: true, messageId: verification.sid };
    }

    if (this.twilioClient) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      this.otpStore.set(phoneNumber, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

      const message = await this.twilioClient.messages.create({
        body: `Tu código de verificación es: ${otp}. Válido por 5 minutos.`,
        from: this.configService.get<string>('TWILIO_PHONE_NUMBER'),
        to: formattedPhone,
      });

      return { success: true, messageId: message.sid };
    }

    if (process.env.NODE_ENV === 'development') {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      this.otpStore.set(phoneNumber, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });
      this.logger.debug(`OTP generated for local development: ${phoneNumber}`);
      return { success: true, messageId: `dev_${Date.now()}` };
    }

    throw new Error('OTP service is not configured');
  }

  async verifyOtp(phoneNumber: string, otp: string): Promise<boolean> {
    const formattedPhone = this.formatPhone(phoneNumber);

    if (this.twilioClient && this.verifySid) {
      try {
        const check = await this.twilioClient.verify.v2
          .services(this.verifySid)
          .verificationChecks.create({ to: formattedPhone, code: otp });

        return check.status === 'approved';
      } catch {
        return false;
      }
    }

    const stored = this.otpStore.get(phoneNumber) ?? this.otpStore.get(formattedPhone);
    if (!stored) return false;
    if (Date.now() > stored.expiresAt) {
      this.otpStore.delete(phoneNumber);
      this.otpStore.delete(formattedPhone);
      return false;
    }
    if (stored.otp !== otp) return false;

    this.otpStore.delete(phoneNumber);
    this.otpStore.delete(formattedPhone);
    return true;
  }

  cleanupExpiredOtps(): void {
    const now = Date.now();
    for (const [key, data] of this.otpStore.entries()) {
      if (now > data.expiresAt) this.otpStore.delete(key);
    }
  }
}
