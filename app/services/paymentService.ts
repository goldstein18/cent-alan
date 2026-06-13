import { AuthService } from './authService';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface GenerateOtpResponse {
  success: boolean;
  message: string;
  otp: string; // OTP siempre se retorna para mostrarlo en la app
}

export class PaymentService {
  private static baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

  /**
   * Genera un OTP de pago automáticamente cuando el usuario hace click en "Pagar con CENT"
   * El OTP dura 2 minutos
   */
  static async generatePaymentOtp(phoneNumber: string): Promise<ApiResponse<GenerateOtpResponse>> {
    try {
      const accessToken = await AuthService.getAccessToken();

      if (!accessToken) {
        return {
          success: false,
          error: 'Usuario no autenticado',
        };
      }

      const response = await fetch(`${this.baseUrl}/payments/generate-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          phoneNumber,
        }),
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.generatePaymentOtp(phoneNumber);
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'Error al generar código OTP de pago',
        };
      }

      // La respuesta del backend es: { success, message, otp }
      return {
        success: true,
        data: {
          success: data.success,
          message: data.message,
          otp: data.otp,
        },
      };
    } catch (error) {
      console.error('Error generating payment OTP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}

