import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthService } from './authService';

const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface StreakResponse {
  days: number;
  weeks: number;
}

export class UsersService {
  private static async getAuthHeaders(): Promise<HeadersInit> {
    const accessToken = await AuthService.getAccessToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };
  }

  /**
   * Actualiza la racha del usuario cuando abre la app
   * También guarda una copia en AsyncStorage como caché
   */
  static async updateStreak(): Promise<ApiResponse<StreakResponse>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${baseUrl}/users/streak`, {
        method: 'PUT',
        headers,
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.updateStreak();
        }
        return {
          success: false,
          error: 'Sesión expirada. Por favor, inicia sesión nuevamente.',
        };
      }

      if (!response.ok) {
        const data = await response.json();
        return {
          success: false,
          error: data?.message || 'No fue posible actualizar la racha',
        };
      }

      const data = await response.json();

      // Guardar en AsyncStorage como caché
      if (data.days !== undefined && data.weeks !== undefined) {
        await AsyncStorage.setItem('streak_cache', JSON.stringify({
          days: data.days,
          weeks: data.weeks,
          lastUpdate: new Date().toISOString(),
        }));
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error updating streak:', error);
      // En caso de error, intentar obtener desde caché
      const cached = await AsyncStorage.getItem('streak_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          success: true,
          data: { days: parsed.days || 0, weeks: parsed.weeks || 0 },
        };
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  /**
   * Obtiene la racha actual del usuario
   * Primero intenta desde el servidor, si falla usa caché local
   */
  static async getStreak(): Promise<ApiResponse<StreakResponse>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${baseUrl}/users/streak`, {
        method: 'GET',
        headers,
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.getStreak();
        }
        // Si no puede refrescar, usar caché
        const cached = await AsyncStorage.getItem('streak_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          return {
            success: true,
            data: { days: parsed.days || 0, weeks: parsed.weeks || 0 },
          };
        }
        return {
          success: false,
          error: 'Sesión expirada',
        };
      }

      if (!response.ok) {
        // Si falla, intentar desde caché
        const cached = await AsyncStorage.getItem('streak_cache');
        if (cached) {
          const parsed = JSON.parse(cached);
          return {
            success: true,
            data: { days: parsed.days || 0, weeks: parsed.weeks || 0 },
          };
        }
        const data = await response.json();
        return {
          success: false,
          error: data?.message || 'No fue posible obtener la racha',
        };
      }

      const data = await response.json();

      // Actualizar caché
      await AsyncStorage.setItem('streak_cache', JSON.stringify({
        days: data.days || 0,
        weeks: data.weeks || 0,
        lastUpdate: new Date().toISOString(),
      }));

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error getting streak:', error);
      // En caso de error, usar caché local
      const cached = await AsyncStorage.getItem('streak_cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        return {
          success: true,
          data: { days: parsed.days || 0, weeks: parsed.weeks || 0 },
        };
      }
      return {
        success: true,
        data: { days: 0, weeks: 0 },
      };
    }
  }

  /**
   * Obtiene la CLABE del usuario
   */
  static async getClabe(): Promise<ApiResponse<{ clabe: string | null }>> {
    try {
      const headers = await this.getAuthHeaders();

      const response = await fetch(`${baseUrl}/users/clabe`, {
        method: 'GET',
        headers,
      });

      if (response.status === 401) {
        const refreshResult = await AuthService.refreshAccessToken();
        if (refreshResult.success) {
          return this.getClabe();
        }
        return {
          success: false,
          error: 'Sesión expirada. Por favor, inicia sesión nuevamente.',
        };
      }

      if (!response.ok) {
        const data = await response.json();
        return {
          success: false,
          error: data?.message || 'No fue posible obtener la CLABE',
        };
      }

      const data = await response.json();

      return {
        success: true,
        data,
      };
    } catch (error) {
      console.error('Error getting CLABE:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido',
      };
    }
  }

  /**
   * Registrar push token del dispositivo en el backend
   */
  static async registerPushToken(token: string, platform?: string): Promise<boolean> {
    try {
      const headers = await UsersService.getAuthHeaders();
      const res = await fetch(`${baseUrl}/notifications/push-token`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ token, platform, appSlug: 'demo-finance-app' }),
      });
      if (!res.ok) {
        console.error(`Error registering push token: HTTP ${res.status}`);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error registering push token:', error);
      return false;
    }
  }

  /**
   * Eliminar push token del dispositivo (al cerrar sesión)
   */
  static async removePushToken(token: string): Promise<void> {
    try {
      const headers = await UsersService.getAuthHeaders();
      await fetch(`${baseUrl}/notifications/push-token`, {
        method: 'DELETE',
        headers,
        body: JSON.stringify({ token }),
      });
    } catch (error) {
      console.error('Error removing push token:', error);
    }
  }
}

