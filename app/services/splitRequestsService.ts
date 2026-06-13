import { AuthService } from './authService';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SplitRequestParticipant {
  id?: string;
  nombre: string;
  telefono: string;
  monto: number;
  estado?: string;
}

export interface SplitRequestSent {
  id: string;
  concepto: string;
  descripcion?: string;
  total: number;
  estado: string;
  fecha: string;
  participantes: SplitRequestParticipant[];
}

export interface SplitRequestReceived {
  id: string;
  concepto: string;
  participantes: number;
  total: number;
  estado: string;
  fecha: string;
  de: string;
}

export interface CreateSplitRequestInput {
  concepto: string;
  descripcion?: string;
  participantes: Array<{ nombre: string; telefono: string; monto: string | number }>;
  pin: string;
}

export class SplitRequestsService {
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

  static async getSentRequests(): Promise<ApiResponse<SplitRequestSent[]>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/split-requests/sent`, {
        method: 'GET',
        headers,
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.getSentRequests();
        }
      }

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data?.message || 'No fue posible obtener las solicitudes' };
      }
      return { success: true, data: Array.isArray(data) ? data : [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async getReceivedRequests(): Promise<ApiResponse<SplitRequestReceived[]>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/split-requests/received`, {
        method: 'GET',
        headers,
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.getReceivedRequests();
        }
      }

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data?.message || 'No fue posible obtener las solicitudes' };
      }
      return { success: true, data: Array.isArray(data) ? data : [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async getRequestDetail(requestId: string): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/split-requests/${requestId}`, {
        method: 'GET',
        headers,
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.getRequestDetail(requestId);
        }
      }

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data?.message || 'No fue posible obtener el detalle' };
      }
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async getParticipantId(requestId: string): Promise<ApiResponse<{ participantId: string | null }>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/split-requests/${requestId}/participant-id`, {
        method: 'GET',
        headers,
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.getParticipantId(requestId);
        }
      }

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data?.message || 'Error' };
      }
      return { success: true, data: { participantId: data?.participantId ?? null } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async createSplitRequest(input: CreateSplitRequestInput): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/split-requests`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          concepto: input.concepto,
          descripcion: input.descripcion,
          participantes: input.participantes,
          pin: input.pin,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        const errorMsg = data?.message || '';
        const isPinError = errorMsg.toLowerCase().includes('pin') || errorMsg.toLowerCase().includes('incorrecto');
        if (isPinError) {
          return { success: false, error: errorMsg || 'PIN incorrecto' };
        }
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.createSplitRequest(input);
        }
      }

      if (!response.ok) {
        return { success: false, error: data?.message || 'No fue posible crear la solicitud' };
      }
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async cancelSplitRequest(requestId: string, pin: string): Promise<ApiResponse<{ message?: string }>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/split-requests/${requestId}/cancel`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();

      if (response.status === 401) {
        const errorMsg = data?.message || '';
        const isPinError = errorMsg.toLowerCase().includes('pin') || errorMsg.toLowerCase().includes('incorrecto');
        if (isPinError) {
          return { success: false, error: errorMsg || 'PIN incorrecto' };
        }
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.cancelSplitRequest(requestId, pin);
        }
      }

      if (!response.ok) {
        return { success: false, error: data?.message || 'No fue posible cancelar la solicitud' };
      }
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async acceptSplitRequest(participantId: string, pin: string): Promise<ApiResponse<{ message?: string }>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/split-requests/participants/${participantId}/accept`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ pin }),
      });

      const data = await response.json();

      if (response.status === 401) {
        const errorMsg = data?.message || '';
        const isPinError = errorMsg.toLowerCase().includes('pin') || errorMsg.toLowerCase().includes('incorrecto');
        if (isPinError) {
          return { success: false, error: errorMsg || 'PIN incorrecto' };
        }
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.acceptSplitRequest(participantId, pin);
        }
      }

      if (!response.ok) {
        return { success: false, error: data?.message || 'No fue posible aceptar la solicitud' };
      }
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async rejectSplitRequest(participantId: string): Promise<ApiResponse<{ message?: string }>> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseUrl}/split-requests/participants/${participantId}/reject`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({}),
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.rejectSplitRequest(participantId);
        }
      }

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data?.message || 'No fue posible rechazar la solicitud' };
      }
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}
