import { AuthService } from './authService';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface GoalApiModel {
  id: string;
  user_id: string;
  name: string;
  category?: string;
  description?: string;
  target_amount: number;
  current_amount?: number;
  progress: number;
  deadline: string;
  frequency?: string;
  payment_type?: string;
  type?: 'sin-rendimiento' | 'con-rendimiento';
  status?: string;
  has_rendimientos: boolean;
  rendimientos_generados: number;
  next_abono_date: string;
  is_completed: boolean;
  is_expired: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CreateGoalRequest {
  name: string;
  category?: string;
  description?: string;
  targetAmount: number;
  deadline: string;
  frequency?: string;
  paymentType?: string;
  type?: 'sin-rendimiento' | 'con-rendimiento';
}

export interface FundGoalRequest {
  amount: number;
  pin: string;
}

export interface WithdrawFromGoalRequest {
  amount: number;
  pin: string;
}

export class GoalsService {
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

  static async getUserGoals(): Promise<ApiResponse<GoalApiModel[]>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/goals`, {
        method: 'GET',
        headers,
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.getUserGoals();
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible obtener las metas',
        };
      }

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
      };
    } catch (error) {
      console.error('Error fetching goals:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async createGoal(goalData: CreateGoalRequest): Promise<ApiResponse<GoalApiModel>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/goals`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: goalData.name,
          category: goalData.category,
          description: goalData.description,
          targetAmount: goalData.targetAmount,
          deadline: goalData.deadline,
          frequency: goalData.frequency,
          paymentType: goalData.paymentType,
          type: goalData.type || 'sin-rendimiento',
          hasRendimientos: goalData.type === 'con-rendimiento',
        }),
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.createGoal(goalData);
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible crear la meta',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error creating goal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async fundGoal(goalId: string, fundData: FundGoalRequest): Promise<ApiResponse<GoalApiModel>> {
    try {
      const headers = await this.getAuthHeaders();

      // Crear un timeout de 30 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
      const response = await fetch(`${this.baseUrl}/goals/${goalId}/fund`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          amount: fundData.amount,
          pin: fundData.pin,
        }),
          signal: controller.signal,
      });

        clearTimeout(timeoutId);

      if (response.status === 401) {
          
          // Leer el cuerpo de la respuesta antes de intentar refrescar
          const errorText = await response.text();
          let errorData = {};
          try {
            if (errorText) {
              errorData = JSON.parse(errorText);
            }
          } catch (e) {
            // Ignorar error de parseo
          }
          
        const refreshResult = await AuthService.refreshAccessToken();
          
          if (refreshResult.success && refreshResult.data) {
            
            // Usar directamente el nuevo token del refresh en lugar de getAuthHeaders()
            // para evitar problemas de sincronización
            const newAccessToken = refreshResult.data.accessToken;
            if (!newAccessToken) {
              console.error('No se recibió accessToken en el refresh');
              return {
                success: false,
                error: 'Error al obtener nuevo token de acceso',
              };
            }
            
            // Asegurarse de que el token no tenga espacios extra
            const cleanToken = newAccessToken.trim();
            
            const newHeaders = {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${cleanToken}`,
            };
            
            
            // Hacer la petición de nuevo con el nuevo token
            const retryController = new AbortController();
            const retryTimeoutId = setTimeout(() => retryController.abort(), 30000);
            
            try {
              const retryResponse = await fetch(`${this.baseUrl}/goals/${goalId}/fund`, {
                method: 'PUT',
                headers: newHeaders,
                body: JSON.stringify({
                  amount: fundData.amount,
                  pin: fundData.pin,
                }),
                signal: retryController.signal,
              });
              
              clearTimeout(retryTimeoutId);
              
              
              // Si aún recibimos 401 después de refrescar, verificar qué está pasando
              if (retryResponse.status === 401) {
                const errorText = await retryResponse.text();
                let errorData: any = {};
                try {
                  if (errorText) {
                    errorData = JSON.parse(errorText);
                  }
                } catch (e) {
                  // Ignorar error de parseo
                }
                
                console.error('401 después de refresh:', {
                  errorText,
                  errorData,
                  tokenUsed: newAccessToken.substring(0, 20) + '...',
                });
                
                // Si el error es de PIN incorrecto, mostrar ese mensaje
                // Si es otro tipo de error 401, mostrar mensaje de sesión expirada
                const errorMessage = errorData?.message || 'Error de autenticación';
                const isPinError = errorMessage.toLowerCase().includes('pin') || 
                                  errorMessage.toLowerCase().includes('incorrecto');
                
                return {
                  success: false,
                  error: isPinError ? errorMessage : 'Sesión expirada. Por favor inicia sesión de nuevo.',
                };
              }
              
              // Verificar si la respuesta tiene contenido antes de parsear JSON
              const retryContentType = retryResponse.headers.get('content-type');
              let retryData;
              
              if (retryContentType && retryContentType.includes('application/json')) {
                const retryText = await retryResponse.text();
                if (retryText) {
                  try {
                    retryData = JSON.parse(retryText);
                  } catch (parseError) {
                    console.error('Error parsing JSON en retry:', parseError);
                    return {
                      success: false,
                      error: 'Error al procesar la respuesta del servidor',
                    };
                  }
                } else {
                  retryData = {};
                }
              } else {
                retryData = {};
              }
              
              if (!retryResponse.ok) {
                return {
                  success: false,
                  error: retryData?.message || retryData?.error || `Error ${retryResponse.status}: No fue posible abonar a la meta`,
                };
              }
              
              return {
                success: true,
                data: retryData,
              };
            } catch (retryError: any) {
              clearTimeout(retryTimeoutId);
              
              if (retryError.name === 'AbortError') {
                return {
                  success: false,
                  error: 'La petición tardó demasiado. Por favor intenta de nuevo.',
                };
              }
              
              throw retryError;
            }
          } else {
            console.error('Error al refrescar token:', refreshResult.error);
            console.error('Detalles del error de refresh:', {
              success: refreshResult.success,
              error: refreshResult.error,
              hasData: !!refreshResult.data,
            });
            
            // Si el refresh falla, intentar limpiar tokens y pedir login de nuevo
            const { AuthService } = await import('./authService');
            await AuthService.logout();
            
            const errorMessage = refreshResult.error || 'Sesión expirada. Por favor inicia sesión de nuevo.';
            console.error('Mensaje de error final:', errorMessage);
            return {
              success: false,
              error: errorMessage,
            };
          }
        }

        // Verificar si la respuesta tiene contenido antes de parsear JSON
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType && contentType.includes('application/json')) {
          const text = await response.text();
          if (text) {
            try {
              data = JSON.parse(text);
            } catch (parseError) {
              console.error('Error parsing JSON:', parseError);
              return {
                success: false,
                error: 'Error al procesar la respuesta del servidor',
              };
            }
          } else {
            data = {};
          }
        } else {
          data = {};
        }

        if (!response.ok) {
          // Si el error es de PIN, mostrar ese mensaje específico
          const errorMessage = data?.message || data?.error || `Error ${response.status}: No fue posible abonar a la meta`;
          const isPinError = errorMessage.toLowerCase().includes('pin') || 
                            errorMessage.toLowerCase().includes('incorrecto');
          
        return {
          success: false,
            error: isPinError ? errorMessage : `Error ${response.status}: ${errorMessage}`,
        };
      }

      return {
        success: true,
        data,
      };
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          return {
            success: false,
            error: 'La petición tardó demasiado. Por favor intenta de nuevo.',
          };
        }
        
        throw fetchError;
      }
    } catch (error) {
      console.error('Error funding goal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido al abonar a la meta',
      };
    }
  }

  static async withdrawFromGoal(goalId: string, withdrawData: WithdrawFromGoalRequest): Promise<ApiResponse<GoalApiModel>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/goals/${goalId}/withdraw`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          amount: withdrawData.amount,
          pin: withdrawData.pin,
        }),
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.withdrawFromGoal(goalId, withdrawData);
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible retirar de la meta',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error withdrawing from goal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async cancelGoal(goalId: string, pin: string): Promise<ApiResponse<{ message?: string }>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/goals/${goalId}/cancel`, {
        method: 'PUT',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pin }),
      });

      if (response.status === 401) {
        const data = await response.json();
        // Check if it's a PIN error or token error
        const isPinError = data?.message?.toLowerCase().includes('pin incorrecto');
        
        if (!isPinError) {
          const refreshResult = await AuthService.refreshAccessToken();
          if (refreshResult.success) {
            return this.cancelGoal(goalId, pin);
          }
        }
        return {
          success: false,
          error: data?.message || 'No fue posible cancelar la meta',
        };
      }

      if (!response.ok) {
        const data = await response.json();
        return {
          success: false,
          error: data?.message || 'No fue posible cancelar la meta',
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: data,
      };
    } catch (error) {
      console.error('Error canceling goal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  static async getCategories(): Promise<ApiResponse<Array<{ code: string; label: string; description?: string; icon?: string; color?: string }>>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${this.baseUrl}/goals/categories`, {
        method: 'GET',
        headers,
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.getCategories();
        }
      }

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data?.message || 'No fue posible obtener las categorías',
        };
      }

      return {
        success: true,
        data: Array.isArray(data) ? data : [],
      };
    } catch (error) {
      console.error('Error fetching categories:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }
}

