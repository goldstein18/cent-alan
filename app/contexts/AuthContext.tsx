import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthService } from '../services/authService';

interface User {
  id: string;
  email?: string;
  phoneNumber?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: User | null;
  login: (phoneNumber: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  loading: boolean;
  restoreSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Verificar si hay sesión guardada al iniciar
  useEffect(() => {
    checkSavedSession();
  }, []);

  const checkSavedSession = async () => {
    try {
      // Inicializar AuthService primero para cargar tokens desde AsyncStorage
      await AuthService.initialize();
      
      const hasToken = await AuthService.isAuthenticated();
      
      if (hasToken) {
        // Intentar refrescar el token automáticamente si hay un refresh token disponible
        // Esto asegura que el usuario permanezca autenticado
        const refreshResult = await AuthService.refreshAccessToken();
        
        if (refreshResult.success) {
        } else {
        }
        
        // Verificar que tenemos un usuario guardado
        const savedUser = await AuthService.getSavedUser();
        if (savedUser) {
          // Verificar que el token sea válido haciendo una petición al perfil
          const profileResult = await AuthService.getProfile();
          
          if (profileResult.success && profileResult.data) {
            // Token válido, restaurar sesión
            const userData = profileResult.data;
            setUser({
              id: userData.id || savedUser.id,
              phoneNumber: userData.phoneNumber || savedUser.phoneNumber,
              firstName: userData.firstName || savedUser.firstName,
              lastName: userData.lastName || savedUser.lastName,
              displayName: `${userData.firstName || savedUser.firstName} ${userData.lastName || savedUser.lastName}`,
            });
            setIsLoggedIn(true);
          } else {
            // Si el perfil falla pero tenemos usuario guardado, restaurar de todos modos
            // El token se refrescará automáticamente cuando se necesite
          setUser({
            id: savedUser.id,
            phoneNumber: savedUser.phoneNumber,
            firstName: savedUser.firstName,
            lastName: savedUser.lastName,
            displayName: `${savedUser.firstName} ${savedUser.lastName}`,
          });
          setIsLoggedIn(true);
          }
        }
      }
    } catch (error) {
      console.error('Error checking saved session:', error);
      // Si hay un error pero tenemos tokens, intentar restaurar de todos modos
      const savedUser = await AuthService.getSavedUser();
      if (savedUser) {
        setUser({
          id: savedUser.id,
          phoneNumber: savedUser.phoneNumber,
          firstName: savedUser.firstName,
          lastName: savedUser.lastName,
          displayName: `${savedUser.firstName} ${savedUser.lastName}`,
        });
        setIsLoggedIn(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (phoneNumber: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      const result = await AuthService.loginWithPassword(phoneNumber, password);
      
      if (result.success && result.data) {
        const userData = result.data.user;
        setUser({
          id: userData.id,
          phoneNumber: userData.phoneNumber,
          firstName: userData.firstName,
          lastName: userData.lastName,
          displayName: `${userData.firstName} ${userData.lastName}`,
        });
        setIsLoggedIn(true);
        return { success: true };
      } else {
        return { success: false, error: result.error || 'Error al iniciar sesión' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Error de conexión' };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await AuthService.logout();
      setUser(null);
      setIsLoggedIn(false);
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
    }
  };

  const restoreSession = async () => {
    await checkSavedSession();
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, user, login, logout, loading, restoreSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
