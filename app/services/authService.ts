import AsyncStorage from '@react-native-async-storage/async-storage';
import { notificationService } from './NotificationService';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    phoneNumber: string;
    firstName: string;
    lastName: string;
  };
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export class AuthService {
  private static baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
  private static accessToken: string | null = null;
  private static refreshToken: string | null = null;

  // Inicializar tokens desde AsyncStorage
  static async initialize() {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      
      
      if (accessToken) this.accessToken = accessToken;
      if (refreshToken) this.refreshToken = refreshToken;
    } catch (error) {
      console.error('Error initializing AuthService:', error);
    }
  }

  // Login con número de teléfono y contraseña
  static async loginWithPassword(phoneNumber: string, password: string): Promise<ApiResponse<LoginResponse>> {
    try {
      // Limpiar número de teléfono
      const cleanPhone = phoneNumber.replace(/\D/g, '');

      const response = await fetch(`${this.baseUrl}/auth/login/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Error al iniciar sesión',
        };
      }

      // Guardar tokens
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      
      
      await AsyncStorage.setItem('accessToken', data.accessToken);
      await AsyncStorage.setItem('refreshToken', data.refreshToken);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      // Guardar para Face ID / biométrico — persiste aunque se cierre sesión
      await AsyncStorage.setItem('biometricRefreshToken', data.refreshToken);

      // Verificar que se guardaron correctamente
      const savedAccessToken = await AsyncStorage.getItem('accessToken');
      const savedRefreshToken = await AsyncStorage.getItem('refreshToken');

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error de conexión',
      };
    }
  }

  // Obtener perfil del usuario
  static async getProfile(): Promise<ApiResponse<any>> {
    try {
      if (!this.accessToken) {
        await this.initialize();
      }

      const response = await fetch(`${this.baseUrl}/auth/profile`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        // Si el token expiró, intentar renovarlo
        if (response.status === 401) {
          const refreshResult = await this.refreshAccessToken();
          if (refreshResult.success) {
            // Reintentar con el nuevo token
            return this.getProfile();
          }
        }

        return {
          success: false,
          error: data.message || 'Error al obtener perfil',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Get profile error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error de conexión',
      };
    }
  }

  // Renovar token de acceso
  static async refreshAccessToken(): Promise<ApiResponse<LoginResponse>> {
    try {
      if (!this.refreshToken) {
        await this.initialize();
      }

      if (!this.refreshToken) {
        return {
          success: false,
          error: 'No refresh token available',
        };
      }


      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: this.refreshToken,
        }),
      });


      // Leer el cuerpo de la respuesta antes de parsear
      const responseText = await response.text();
      let data: any = {};
      
      try {
        if (responseText) {
          data = JSON.parse(responseText);
        }
      } catch (parseError) {
        console.error('Error parsing refresh response:', parseError);
        console.error('Response text:', responseText);
        return {
          success: false,
          error: 'Error al procesar la respuesta del servidor',
        };
      }
      

      if (!response.ok) {
        console.error('Error al refrescar token:', data.message || 'Error desconocido');
        // Si el refresh token también expiró, limpiar todo
        if (response.status === 401) {
          this.accessToken = null;
          this.refreshToken = null;
          await AsyncStorage.removeItem('accessToken');
          await AsyncStorage.removeItem('refreshToken');
          await AsyncStorage.removeItem('user');
        }
        return {
          success: false,
          error: data.message || 'Error al renovar token',
        };
      }

      // Actualizar tokens en memoria PRIMERO (asegurarse de que no tengan espacios)
      this.accessToken = data.accessToken?.trim() || data.accessToken;
      this.refreshToken = data.refreshToken?.trim() || data.refreshToken;
      
      // Luego guardar en AsyncStorage
      await AsyncStorage.setItem('accessToken', data.accessToken);
      await AsyncStorage.setItem('refreshToken', data.refreshToken);
      
      // Actualizar también el usuario si viene en la respuesta
      if (data.user) {
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
      }


      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Refresh token error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error de conexión',
      };
    }
  }

  // Cerrar sesión
  static async logout(): Promise<void> {
    try {
      // Eliminar push token del backend antes de cerrar sesión
      // (inline fetch to avoid circular import with usersService)
      const pushToken = notificationService.getExpoPushToken();
      if (pushToken && this.accessToken) {
        try {
          await fetch(`${this.baseUrl}/notifications/push-token`, {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.accessToken}`,
            },
            body: JSON.stringify({ token: pushToken }),
          });
        } catch (tokenError) {
          console.error('Error removing push token on logout:', tokenError);
        }
      }

      // Logout en el servidor
      if (this.accessToken) {
        await fetch(`${this.baseUrl}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.accessToken}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Guardar refresh token para Face ID / biométrico antes de limpiar
      const tokenToKeep = this.refreshToken || await AsyncStorage.getItem('refreshToken');
      if (tokenToKeep) {
        await AsyncStorage.setItem('biometricRefreshToken', tokenToKeep);
      }

      // Limpiar tokens de sesión
      this.accessToken = null;
      this.refreshToken = null;

      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');
      await AsyncStorage.removeItem('user');
    }
  }

  // Verificar si el usuario está autenticado
  static async isAuthenticated(): Promise<boolean> {
    try {
      if (!this.accessToken) {
        await this.initialize();
      }
      
      return !!this.accessToken;
    } catch {
      return false;
    }
  }

  // Obtener usuario guardado localmente
  static async getSavedUser(): Promise<any> {
    try {
      const userStr = await AsyncStorage.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  }

  // Obtener access token con renovación automática si es necesario
  static async getAccessToken(): Promise<string | null> {
    // Si no hay token en memoria, intentar cargar desde AsyncStorage
    if (!this.accessToken) {
      await this.initialize();
    }
    
    // Si aún no hay token después de inicializar, retornar null
    if (!this.accessToken) {
      return null;
    }
    
    // Retornar el token que está en memoria (debe estar actualizado después del refresh)
    return this.accessToken;
  }

  // Verificar y renovar token si es necesario (usado internamente)
  static async ensureValidToken(): Promise<string | null> {
    const token = await this.getAccessToken();
    if (!token) {
      return null;
    }
    
    // Si hay un refresh token disponible, intentar renovar si es necesario
    // Nota: La validación real del token se hace en el backend
    // Si recibimos 401, los servicios deben llamar a refreshAccessToken()
    return token;
  }

  // Cambiar PIN de seguridad
  static async changePin(currentPin: string, newPin: string): Promise<ApiResponse<{ message: string }>> {
    try {
      if (!this.accessToken) {
        await this.initialize();
      }

      if (!this.accessToken) {
        return {
          success: false,
          error: 'Usuario no autenticado',
        };
      }

      // Solo incluir currentPin si tiene un valor (no enviar si está vacío)
      const body: any = { newPin };
      if (currentPin && currentPin.trim() !== '') {
        body.currentPin = currentPin;
      }

      const response = await fetch(`${this.baseUrl}/users/change-pin`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        // Si el token expiró, intentar renovarlo
        if (response.status === 401) {
          const refreshResult = await this.refreshAccessToken();
          if (refreshResult.success) {
            // Reintentar con el nuevo token
            return this.changePin(currentPin, newPin);
          }
        }

        return {
          success: false,
          error: data.message || 'Error al cambiar el PIN',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Change PIN error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error de conexión',
      };
    }
  }

  // Cambiar contraseña de acceso
  static async changePassword(currentPassword: string, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    try {
      if (!this.accessToken) {
        await this.initialize();
      }

      if (!this.accessToken) {
        return {
          success: false,
          error: 'Usuario no autenticado',
        };
      }

      const response = await fetch(`${this.baseUrl}/users/change-password`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          const refreshResult = await this.refreshAccessToken();
          if (refreshResult.success) {
            return this.changePassword(currentPassword, newPassword);
          }
        }

        return {
          success: false,
          error: data.message || 'Error al cambiar la contraseña',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error de conexión',
      };
    }
  }

  // Enviar código OTP por SMS
  static async sendOtp(phoneNumber: string, email?: string): Promise<ApiResponse<{ message: string; expiresIn?: number }>> {
    try {
      // Limpiar número de teléfono
      const cleanPhone = phoneNumber.replace(/\D/g, '');

      const response = await fetch(`${this.baseUrl}/auth/send-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          ...(email ? { email } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Error al enviar código OTP',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Send OTP error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error de conexión',
      };
    }
  }

  // Verificar código OTP
  static async verifyOtp(phoneNumber: string, otp: string): Promise<ApiResponse<{ message: string }>> {
    try {
      // Limpiar número de teléfono
      const cleanPhone = phoneNumber.replace(/\D/g, '');

      const response = await fetch(`${this.baseUrl}/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          otp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Código OTP inválido o expirado',
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Verify OTP error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error de conexión',
      };
    }
  }

  // Restablecer contraseña; el OTP se verifica una sola vez en este endpoint
  static async resetPassword(phoneNumber: string, otp: string, newPassword: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const response = await fetch(`${this.baseUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: cleanPhone, otp, newPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.message || 'Error al restablecer contraseña' };
      }
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Error de conexión' };
    }
  }

  // Registrar nuevo usuario (signup)
  static async signup(userData: {
    phoneNumber: string;
    email: string;
    firstName: string;
    lastName: string;
    secondLastName?: string;
    birthDate: string;
    gender: string;
    street: string;
    exteriorNumber: string;
    interiorNumber?: string;
    neighborhood: string;
    postalCode: string;
    city: string;
    state: string;
    password: string;
    otp: string;
    referredBy?: string;
  }): Promise<ApiResponse<LoginResponse>> {
    try {
      // Limpiar número de teléfono
      const cleanPhone = userData.phoneNumber.replace(/\D/g, '');

      const response = await fetch(`${this.baseUrl}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: cleanPhone,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          secondLastName: userData.secondLastName,
          birthDate: userData.birthDate,
          gender: userData.gender,
          street: userData.street,
          exteriorNumber: userData.exteriorNumber,
          interiorNumber: userData.interiorNumber,
          neighborhood: userData.neighborhood,
          postalCode: userData.postalCode,
          city: userData.city,
          state: userData.state,
          password: userData.password,
          otp: userData.otp,
          referredBy: userData.referredBy,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'Error al crear la cuenta',
        };
      }

      // Guardar tokens
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      
      await AsyncStorage.setItem('accessToken', data.accessToken);
      await AsyncStorage.setItem('refreshToken', data.refreshToken);
      await AsyncStorage.setItem('user', JSON.stringify(data.user));
      await AsyncStorage.setItem('biometricRefreshToken', data.refreshToken);

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Signup error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error de conexión',
      };
    }
  }
}

