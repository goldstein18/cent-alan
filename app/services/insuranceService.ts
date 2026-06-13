import { AuthService } from './authService';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface InsurancePlan {
  id: string;
  name: string;
  description: string;
  monthlyPremium: number;
  annualPremium: number;
  coverage: string[];
  benefits: string[];
}

export interface InsuranceContract {
  id: string;
  planId: string;
  planName: string;
  beneficiaryName: string;
  beneficiaryPhone: string;
  contractDate: string;
  planType: 'mensual' | 'anual';
  status: 'active' | 'cancelled' | 'expired';
  created_at: string;
  updated_at?: string;
  userId?: string;
  beneficiaryUserId?: string;
  ownerName?: string;
  ownerPhone?: string;
  beneficiaryType?: string;
  isBeneficiary?: boolean;
  policyNumber?: string;
  individualPolicyNumber?: string;
  endDate?: string;
}

export interface ContractInsuranceRequest {
  planId: string;
  beneficiary: 'para-mi' | 'tercero';
  phone?: string;
  email?: string;
  firstName?: string;
  secondName?: string;
  paternalLastName?: string;
  maternalLastName?: string;
  birthDate?: string;
  rfc?: string;
  curp?: string;
  gender?: string;
  planType: 'mensual' | 'anual';
  pin: string;
}

export class InsuranceService {
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

  static async getPlans(): Promise<ApiResponse<InsurancePlan[]>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/insurance/plans`, {
        method: 'GET',
        headers,
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.getPlans();
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible obtener los planes de seguro',
        };
      }

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
      };
    } catch (error) {
      console.error('Error fetching insurance plans:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async contractInsurance(contractData: ContractInsuranceRequest): Promise<ApiResponse<InsuranceContract>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/insurance/contract`, {
        method: 'POST',
        headers,
        body: JSON.stringify(contractData),
      });

      const data = await response.json();

      if (response.status === 401) {
        // Verificar si el error es por PIN incorrecto o por token expirado
        const errorMessage = data?.message || '';
        if (errorMessage.toLowerCase().includes('pin incorrecto') || 
            errorMessage.toLowerCase().includes('pin requerido')) {
          // Error de autorización del usuario (PIN incorrecto), no refrescar token
          return {
            success: false,
            error: errorMessage || 'PIN incorrecto',
          };
        }
        // Token expirado, intentar refrescar
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.contractInsurance(contractData);
        }
        return {
          success: false,
          error: 'Sesión expirada. Por favor, inicia sesión nuevamente.',
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible contratar el seguro',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error contracting insurance:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async getContracts(): Promise<ApiResponse<InsuranceContract[]>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/insurance/contracts`, {
        method: 'GET',
        headers,
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.getContracts();
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible obtener los contratos',
        };
      }

      // Log para debugging

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
      };
    } catch (error) {
      console.error('Error fetching contracts:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async cancelContract(contractId: string): Promise<ApiResponse<{ id: string; status: string }>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/insurance/contracts/${contractId}/cancel`, {
        method: 'POST',
        headers,
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.cancelContract(contractId);
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible cancelar el contrato',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error canceling contract:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}

