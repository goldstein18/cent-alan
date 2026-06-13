import { AuthService } from './authService';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface BeneficiaryModel {
  id: string;
  name: string;
  phone: string;
  email?: string;
  relationship: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface CreateBeneficiaryRequest {
  name: string;
  phone: string;
  email?: string;
  relationship?: string;
  isPrimary?: boolean;
}

export class BeneficiariesService {
  private static baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

  private static async getHeaders() {
    const token = await AuthService.getAccessToken();
    if (!token) {
      throw new Error('Usuario no autenticado');
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  static async getBeneficiaries(): Promise<ApiResponse<BeneficiaryModel[]>> {
    try {
      const headers = await this.getHeaders();

      const response = await fetch(`${this.baseUrl}/beneficiaries`, {
        method: 'GET',
        headers,
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.getBeneficiaries();
        }
      }

      if (!response.ok) {
        const errorResponse = await response.json().catch(() => null);
        return {
          success: false,
          error: errorResponse?.message || 'No fue posible obtener los beneficiarios',
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: Array.isArray(data) ? data : [],
      };
    } catch (error) {
      console.error('Error fetching beneficiaries:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async createBeneficiary(payload: CreateBeneficiaryRequest): Promise<ApiResponse<BeneficiaryModel>> {
    try {
      const headers = await this.getHeaders();

      const response = await fetch(`${this.baseUrl}/beneficiaries`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.createBeneficiary(payload);
        }
      }

      if (!response.ok) {
        const errorResponse = await response.json().catch(() => null);
        return {
          success: false,
          error: errorResponse?.message || 'No fue posible agregar el beneficiario',
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error creating beneficiary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async deleteBeneficiary(id: string): Promise<ApiResponse<null>> {
    try {
      const headers = await this.getHeaders();

      const response = await fetch(`${this.baseUrl}/beneficiaries/${id}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorResponse = await response.json().catch(() => null);
        return {
          success: false,
          error: errorResponse?.message || 'No fue posible eliminar el beneficiario',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting beneficiary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}

