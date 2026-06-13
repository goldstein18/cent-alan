import { AuthService } from './authService';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface InvestmentRateModel {
  type: 'normal' | 'pro';
  interestRate: number;
  updatedAt: string;
}

export interface CreateInvestmentRateRequest {
  type: 'normal' | 'pro';
  interestRate: number;
}

export class InvestmentRatesService {
  private static baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

  private static async getAuthHeaders() {
    const token = await AuthService.getAccessToken();
    if (!token) {
      throw new Error('Usuario no autenticado');
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  static async getRates(): Promise<ApiResponse<InvestmentRateModel[]>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/investment-rates`, {
        method: 'GET',
        headers,
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.getRates();
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible obtener las tasas',
        };
      }

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
      };
    } catch (error) {
      console.error('Error fetching investment rates:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async setRate(payload: CreateInvestmentRateRequest): Promise<ApiResponse<InvestmentRateModel>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/investment-rates`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.setRate(payload);
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible actualizar la tasa',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error updating investment rate:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}

