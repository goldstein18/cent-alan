import { AuthService } from './authService';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface InvestmentApiModel {
  id: string;
  amount: number;
  term: number;
  interest_rate: number;
  maturity_date: string;
  status: 'active' | 'matured' | 'cancelled';
  is_domiciliation?: boolean;
  periodicity?: 'semanal' | 'quincenal' | 'mensual';
  periodicity_days?: number;
  next_charge_date?: string;
  charge_day?: number;
  is_paused?: boolean;
  is_cancelled?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateInvestmentRequest {
  amount: number;
  term: number;
  pin: string;
}

export interface CreateDomiciliationRequest {
  amount: number;
  periodicity: 'diaria' | 'semanal' | 'quincenal' | 'mensual';
  chargeDay: number;
  startDate?: string; // Fecha de inicio en formato YYYY-MM-DD
  term?: number; // Plazo en meses: 3, 6, 9, 12
  pin: string;
}

export interface ManageDomiciliationRequest {
  action: 'pause' | 'resume' | 'cancel' | 'update_schedule';
  chargeDay?: number;
  periodicityDays?: number;
  periodicity?: string;
  startDate?: string;
  amount?: number;
}

export class InvestmentService {
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

  static async getUserInvestments(): Promise<ApiResponse<InvestmentApiModel[]>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/investments`, {
        method: 'GET',
        headers,
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.getUserInvestments();
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible obtener las inversiones',
        };
      }

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
      };
    } catch (error) {
      console.error('Error fetching investments:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async createInvestment(investmentData: CreateInvestmentRequest): Promise<ApiResponse<InvestmentApiModel>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/investments`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: investmentData.amount,
          term: investmentData.term,
          pin: investmentData.pin,
        }),
      });

      // Leer el cuerpo de la respuesta antes de decidir si refrescar el token
      const responseText = await response.text();
      let data: any = {};
      
      try {
        if (responseText) {
          data = JSON.parse(responseText);
        }
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
      }

      // Solo refrescar token si es un 401 y el error NO es específico de PIN o autorización de usuario
      // Si el error es "PIN incorrecto" o similar, no refrescar (es un error de validación del usuario)
      if (response.status === 401) {
        const errorMessage = data?.message || '';
        const isUserAuthError = errorMessage.toLowerCase().includes('pin') || 
                               errorMessage.toLowerCase().includes('incorrecto') ||
                               errorMessage.toLowerCase().includes('unauthorized');
        
        // Si es un error de autorización del usuario (PIN incorrecto, etc), devolver el error directamente
        if (isUserAuthError) {
          return {
            success: false,
            error: errorMessage || 'No fue posible crear la inversión',
          };
        }
        
        // Si es un 401 por token expirado, intentar refrescar
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.createInvestment(investmentData);
        }
      }

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible crear la inversión',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error creating investment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async createDomiciliation(domiciliationData: CreateDomiciliationRequest): Promise<ApiResponse<InvestmentApiModel>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/investments/domiciliation`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: domiciliationData.amount,
          periodicity: domiciliationData.periodicity,
          chargeDay: domiciliationData.chargeDay,
          startDate: domiciliationData.startDate,
          term: domiciliationData.term,
          pin: domiciliationData.pin,
        }),
      });

      // Leer el cuerpo de la respuesta antes de decidir si refrescar el token
      const responseText = await response.text();
      let data: any = {};
      
      try {
        if (responseText) {
          data = JSON.parse(responseText);
        }
      } catch (parseError) {
        console.error('Error parsing response:', parseError);
      }

      // Solo refrescar token si es un 401 y el error NO es específico de PIN o autorización de usuario
      // Si el error es "PIN incorrecto" o similar, no refrescar (es un error de validación del usuario)
      if (response.status === 401) {
        const errorMessage = data?.message || '';
        const isUserAuthError = errorMessage.toLowerCase().includes('pin') || 
                               errorMessage.toLowerCase().includes('incorrecto') ||
                               errorMessage.toLowerCase().includes('unauthorized');
        
        // Si es un error de autorización del usuario (PIN incorrecto, etc), devolver el error directamente
        if (isUserAuthError) {
          return {
            success: false,
            error: errorMessage || 'No fue posible crear la domiciliación',
          };
        }
        
        // Si es un 401 por token expirado, intentar refrescar
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.createDomiciliation(domiciliationData);
        }
      }

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible crear la domiciliación',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error creating domiciliation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async manageDomiciliation(investmentId: string, managementData: ManageDomiciliationRequest): Promise<ApiResponse<InvestmentApiModel>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/investments/${investmentId}/management`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(managementData),
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.manageDomiciliation(investmentId, managementData);
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible gestionar la domiciliación',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error managing domiciliation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}


