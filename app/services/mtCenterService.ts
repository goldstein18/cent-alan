import { AuthService } from './authService';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ServiceProvider {
  id: string;
  name: string;
  category: string;
  logo?: string;
  description?: string;
}

export interface ServiceBill {
  id: string;
  providerId: string;
  providerName: string;
  accountNumber: string;
  accountName?: string;
  amount: number;
  dueDate?: string;
  status: 'pending' | 'paid' | 'overdue';
  reference?: string;
}

export interface ServicePaymentRequest {
  providerId: string;
  accountNumber: string;
  amount: number;
  reference?: string;
  pin: string;
}

export interface ServicePaymentResponse {
  transactionId: string;
  reference: string;
  amount: number;
  providerName: string;
  status: 'completed' | 'pending' | 'failed';
  timestamp: string;
}

export interface QueryBillRequest {
  providerId: string;
  accountNumber: string;
}

export class MtCenterService {
  private static baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

  /**
   * Get available service providers
   */
  static async getProviders(): Promise<ApiResponse<ServiceProvider[]>> {
    try {
      const accessToken = await AuthService.getAccessToken();

      if (!accessToken) {
        return {
          success: false,
          error: 'Usuario no autenticado',
        };
      }

      const response = await fetch(`${this.baseUrl}/mt-center/providers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.getProviders();
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible obtener los proveedores de servicios',
        };
      }

      return {
        success: true,
        data: data.providers || data,
      };
    } catch (error) {
      console.error('Error getting providers:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  /**
   * Query a bill by provider and account number
   */
  static async queryBill(
    request: QueryBillRequest
  ): Promise<ApiResponse<ServiceBill>> {
    try {
      const accessToken = await AuthService.getAccessToken();

      if (!accessToken) {
        return {
          success: false,
          error: 'Usuario no autenticado',
        };
      }

      const response = await fetch(`${this.baseUrl}/mt-center/query-bill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(request),
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.queryBill(request);
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible consultar el recibo',
        };
      }

      return {
        success: true,
        data: data.bill || data,
      };
    } catch (error) {
      console.error('Error querying bill:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  /**
   * Pay a service bill
   */
  static async payService(
    request: ServicePaymentRequest
  ): Promise<ApiResponse<ServicePaymentResponse>> {
    try {
      const accessToken = await AuthService.getAccessToken();

      if (!accessToken) {
        return {
          success: false,
          error: 'Usuario no autenticado',
        };
      }

      const response = await fetch(`${this.baseUrl}/mt-center/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(request),
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.payService(request);
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible procesar el pago',
        };
      }

      return {
        success: true,
        data: data.payment || data,
      };
    } catch (error) {
      console.error('Error paying service:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  /**
   * Get payment history
   */
  static async getPaymentHistory(): Promise<ApiResponse<ServicePaymentResponse[]>> {
    try {
      const accessToken = await AuthService.getAccessToken();

      if (!accessToken) {
        return {
          success: false,
          error: 'Usuario no autenticado',
        };
      }

      const response = await fetch(`${this.baseUrl}/mt-center/payments`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.getPaymentHistory();
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible obtener el historial de pagos',
        };
      }

      return {
        success: true,
        data: data.payments || data,
      };
    } catch (error) {
      console.error('Error getting payment history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}

