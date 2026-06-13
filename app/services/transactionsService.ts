import { AuthService } from './authService';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export type TransactionType =
  | 'deposit'
  | 'payment'
  | 'internal_transfer'
  | 'external_transfer'
  | 'investment'
  | 'withdrawal';

export interface TransactionApiModel {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  description?: string;
  reference?: string;
  status?: string;
  to_account?: string;
  to_user_id?: string;
  bank_name?: string;
  clabe?: string;
  account_holder_name?: string;
  payment_method?: string;
  payment_reference?: string;
  fee_amount?: number;
  tax_amount?: number;
  net_amount?: number;
  metadata?: Record<string, unknown>;
  processed_by?: string;
  processed_at?: string;
  created_at: string;
  updated_at?: string;
}

export interface ExternalTransferRequest {
  beneficiaryName: string;
  bankName: string;
  clabe: string;
  amount: number;
  description?: string;
  pin: string;
}

export interface InternalTransferRequest {
  recipientPhoneNumber: string;
  amount: number;
  description: string;
  pin: string;
}

export interface DepositRequest {
  amount: number;
  description: string;
  reference: string;
}

export interface PaymentRequest {
  amount: number;
  description: string;
  reference: string;
  pin: string;
}

export class TransactionsService {
  private static baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

  static async getUserTransactions(): Promise<ApiResponse<TransactionApiModel[]>> {
    try {
      const accessToken = await AuthService.getAccessToken();

      if (!accessToken) {
        return {
          success: false,
          error: 'Usuario no autenticado',
        };
      }

      const response = await fetch(`${this.baseUrl}/transactions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.getUserTransactions();
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible obtener las transacciones',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error fetching transactions:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async createExternalTransfer(
    payload: ExternalTransferRequest
  ): Promise<ApiResponse<TransactionApiModel>> {
    try {
      const accessToken = await AuthService.getAccessToken();

      if (!accessToken) {
        return {
          success: false,
          error: 'Usuario no autenticado',
        };
      }

      const response = await fetch(`${this.baseUrl}/transactions/transfer-external`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
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
            error: errorMessage || 'No fue posible procesar la transferencia externa',
          };
        }
        
        // Si es un 401 por token expirado, intentar refrescar
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.createExternalTransfer(payload);
        }
      }

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible procesar la transferencia externa',
        };
      }

      // Si llegamos aquí, la respuesta fue exitosa, usar data parseado
      return {
        success: true,
        data: data as TransactionApiModel,
      };
    } catch (error) {
      console.error('Error creating external transfer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async createInternalTransfer(
    payload: InternalTransferRequest
  ): Promise<ApiResponse<TransactionApiModel>> {
    try {
      const accessToken = await AuthService.getAccessToken();

      if (!accessToken) {
        return {
          success: false,
          error: 'Usuario no autenticado',
        };
      }

      const response = await fetch(`${this.baseUrl}/transactions/transfer-internal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          toPhoneNumber: payload.recipientPhoneNumber,
          amount: payload.amount,
          description: payload.description,
          pin: payload.pin,
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
            error: errorMessage || 'No fue posible procesar la transferencia interna',
          };
        }
        
        // Si es un 401 por token expirado, intentar refrescar
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.createInternalTransfer(payload);
        }
      }

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible procesar la transferencia interna',
        };
      }

      // Si llegamos aquí, la respuesta fue exitosa, usar data parseado
      return {
        success: true,
        data: data as TransactionApiModel,
      };
    } catch (error) {
      console.error('Error creating internal transfer:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async createDeposit(
    payload: DepositRequest
  ): Promise<ApiResponse<TransactionApiModel>> {
    try {
      const accessToken = await AuthService.getAccessToken();

      if (!accessToken) {
        return {
          success: false,
          error: 'Usuario no autenticado',
        };
      }

      const response = await fetch(`${this.baseUrl}/transactions/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.createDeposit(payload);
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible procesar el abono',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error creating deposit:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async createPayment(
    payload: PaymentRequest
  ): Promise<ApiResponse<TransactionApiModel>> {
    try {
      const accessToken = await AuthService.getAccessToken();

      if (!accessToken) {
        return {
          success: false,
          error: 'Usuario no autenticado',
        };
      }

      const response = await fetch(`${this.baseUrl}/transactions/payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.createPayment(payload);
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
        data,
      };
    } catch (error) {
      console.error('Error creating payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}

