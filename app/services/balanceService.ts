import { AuthService } from './authService';

export interface BalanceBreakdown {
  deposits: number;
  payments: number;
  internalTransfers: number;
  externalTransfers: number;
  activeInvestmentsPrincipal: number;
  maturedInvestmentsTotal: number;
  goalsTotal: number;
}

export interface BalanceResponse {
  userId: string;
  availableBalance?: number;
  totalBalance?: number;
  breakdown: BalanceBreakdown;
}

export class BalanceService {
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

  static async getAvailableBalance(): Promise<BalanceResponse> {
    const makeRequest = async () => {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/balance/available`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        // Si es 401, intentar refrescar el token
        if (response.status === 401) {
          const refreshResult = await AuthService.refreshAccessToken();
          if (refreshResult.success) {
            // Reintentar con el nuevo token
            const newHeaders = await this.getAuthHeaders();
            const retryResponse = await fetch(`${this.baseUrl}/balance/available`, {
              method: 'GET',
              headers: newHeaders,
            });
            
            if (!retryResponse.ok) {
              let errorMessage = 'No fue posible obtener el saldo disponible';
              try {
                const errorData = await retryResponse.json();
                errorMessage = errorData?.message || errorData?.error || errorMessage;
              } catch {
                errorMessage = `Error ${retryResponse.status}: ${retryResponse.statusText}`;
              }
              throw new Error(errorMessage);
            }
            return retryResponse.json();
          }
        }
        
        let errorMessage = 'No fue posible obtener el saldo disponible';
        try {
          const errorData = await response.json();
          errorMessage = errorData?.message || errorData?.error || errorMessage;
        } catch {
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        console.error('Error fetching available balance:', errorMessage);
        throw new Error(errorMessage);
      }

      return response.json();
    };

    return makeRequest();
  }

  static async getTotalBalance(): Promise<BalanceResponse> {
    const makeRequest = async () => {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/balance/total`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        // Si es 401, intentar refrescar el token
        if (response.status === 401) {
          const refreshResult = await AuthService.refreshAccessToken();
          if (refreshResult.success) {
            // Reintentar con el nuevo token
            const newHeaders = await this.getAuthHeaders();
            const retryResponse = await fetch(`${this.baseUrl}/balance/total`, {
              method: 'GET',
              headers: newHeaders,
            });
            
            if (!retryResponse.ok) {
              let errorMessage = 'No fue posible obtener el dinero total';
              try {
                const errorData = await retryResponse.json();
                errorMessage = errorData?.message || errorData?.error || errorMessage;
              } catch {
                errorMessage = `Error ${retryResponse.status}: ${retryResponse.statusText}`;
              }
              throw new Error(errorMessage);
            }
            return retryResponse.json();
          }
        }
        
        let errorMessage = 'No fue posible obtener el dinero total';
        try {
          const errorData = await response.json();
          errorMessage = errorData?.message || errorData?.error || errorMessage;
        } catch {
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }
        console.error('Error fetching total balance:', errorMessage);
        throw new Error(errorMessage);
      }

      return response.json();
    };

    return makeRequest();
  }
}


