import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { Stack } from 'expo-router';
import React from 'react';
import { Animated, Dimensions, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ForgotPassword from './auth/forgot-password';
import LoginScreen from './auth/login';
import SignupWizard from './auth/signup-wizard';
import { LockScreen } from './components/LockScreen';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DataProvider } from './contexts/DataContext';
import { LockProvider, useLock } from './contexts/LockContext';
import { notificationService } from './services/NotificationService';
import { UsersService } from './services/usersService';

const { width, height } = Dimensions.get('window');

function AppContent() {
  const { isLoggedIn, logout } = useAuth();
  const { isLocked, resetTimer, unlockWithBiometrics } = useLock();
  const [authScreen, setAuthScreen] = React.useState('welcome');

  // Animation values
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;
  const logoScaleAnim = React.useRef(new Animated.Value(0.8)).current;


  // ── Push Notifications ──────────────────────────────────────
  React.useEffect(() => {
    if (!isLoggedIn) return;

    let notifSub: any;
    let responseSub: any;

    let cancelled = false;

    const setupNotifications = async () => {
      try {
        // Small delay to ensure auth token is persisted and readable
        await new Promise(resolve => setTimeout(resolve, 1500));

        const token = await notificationService.registerForPushNotifications();
        if (token) {
          const platform = Platform.OS === 'ios' ? 'ios' : 'android';
          // Reintentar el registro: si falla (token de auth aún no listo, fallo de
          // red, 401 transitorio) el dispositivo nunca quedaría registrado y NO
          // recibiría ninguna notificación push. Reintentamos con backoff.
          const maxAttempts = 5;
          for (let attempt = 1; attempt <= maxAttempts && !cancelled; attempt++) {
            const ok = await UsersService.registerPushToken(token, platform);
            if (ok) {
              break;
            }
            if (attempt < maxAttempts) {
              const backoffMs = Math.min(1000 * 2 ** (attempt - 1), 15000);
              await new Promise(resolve => setTimeout(resolve, backoffMs));
            } else {
              console.error('❌ Push token registration failed after all retries');
            }
          }
        }

        // Handle notifications received while app is in foreground
        notifSub = notificationService.addNotificationReceivedListener((notification) => {
        });

        // Handle user tapping a notification
        responseSub = notificationService.addNotificationResponseReceivedListener((response) => {
          const data = response.notification.request.content.data as any;
          // Navigation based on `screen` field can be added here
        });
      } catch (error) {
        console.error('Error setting up push notifications:', error);
      }
    };

    setupNotifications();

    return () => {
      cancelled = true;
      notifSub?.remove();
      responseSub?.remove();
    };
  }, [isLoggedIn]);
  // ────────────────────────────────────────────────────────────

  // Start animations when welcome screen loads
  React.useEffect(() => {
    if (!isLoggedIn && authScreen === 'welcome') {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(logoScaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLoggedIn, authScreen]);

  if (!isLoggedIn) {
    
    if (authScreen === 'login') {
      return (
        <LoginScreen
          onBack={() => setAuthScreen('welcome')}
          onForgotPassword={() => setAuthScreen('forgot-password')}
        />
      );
    }

    if (authScreen === 'forgot-password') {
      return (
        <ForgotPassword
          onBack={() => setAuthScreen('login')}
          onSuccess={() => setAuthScreen('login')}
        />
      );
    }

    if (authScreen === 'signup') {
      return <SignupWizard onBack={() => setAuthScreen('welcome')} />;
    }
    
    // Default to welcome screen
    return (
      <View style={styles.container}>
        {/* Hero Section with Animation */}
        <Animated.View 
          style={[
            styles.heroSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Animated.View 
            style={[
              styles.animationContainer,
              {
                transform: [{ scale: logoScaleAnim }]
              }
            ]}
          >
            <Image 
              source={require('../assets/images/iconremove.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
          </Animated.View>
          
          <Text style={styles.heroTitle}>Bienvenido a CENT</Text>
          <Text style={styles.heroSubtitle}>
            Tu app financiera para ahorrar, invertir y proteger tu futuro
          </Text>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View 
          style={[
            styles.buttonContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <TouchableOpacity 
            style={[styles.button, styles.loginButton]} 
            onPress={() => {
              setAuthScreen('login');
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="log-in-outline" size={24} color="#3dbac6" />
            <Text style={styles.loginButtonText}>Iniciar sesión</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.button, styles.signupButton]} 
            onPress={() => {
              setAuthScreen('signup');
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="person-add-outline" size={24} color="white" />
            <Text style={styles.signupButtonText}>Crear cuenta</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Footer */}
        <Animated.View 
          style={[
            styles.footer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Text style={styles.footerText}>
            Al continuar, aceptas nuestros{' '}
            <Text style={styles.linkText}>Términos de Servicio</Text>
            {' '}y{' '}
            <Text style={styles.linkText}>Política de Privacidad</Text>
          </Text>
        </Animated.View>
      </View>
    );
  }


  // Pantalla de bloqueo por inactividad
  if (isLocked) {
    return (
      <LockScreen
        onUnlock={unlockWithBiometrics}
        onLogout={logout}
      />
    );
  }

  return (
    <View style={{ flex: 1 }} onTouchStart={resetTimer}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </View>
  );
}

function LockProviderWrapper({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, logout } = useAuth();
  return (
    <LockProvider isLoggedIn={isLoggedIn} onFullLogout={logout}>
      {children}
    </LockProvider>
  );
}

export default function RootLayout() {
  const [isUpdateAvailable, setIsUpdateAvailable] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);

  React.useEffect(() => {
    async function checkForUpdates() {
      if (__DEV__) {
        // Skip update checks in development
        return;
      }

      try {
        const update = await Updates.checkForUpdateAsync();
        
        if (update.isAvailable) {
          setIsUpdateAvailable(true);
          
          // Automatically download and apply the update
          const result = await Updates.fetchUpdateAsync();
          
          if (result.isNew) {
            // Reload the app to apply the update
            await Updates.reloadAsync();
          }
        }
      } catch (error) {
        console.error('Error checking for updates:', error);
      }
    }

    checkForUpdates();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <LockProviderWrapper>
          <DataProvider>
            <AppContent />
          </DataProvider>
        </LockProviderWrapper>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F7',
    paddingHorizontal: 24,
  },
  heroSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  animationContainer: {
    width: 200,
    height: 200,
    marginBottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  logoImage: {
    width: 200,
    height: 200,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3dbac6',
    textAlign: 'center',
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    paddingBottom: 40,
    gap: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  loginButton: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#3dbac6',
  },
  signupButton: {
    backgroundColor: '#3dbac6',
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3dbac6',
    marginLeft: 8,
  },
  signupButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginLeft: 8,
  },
  footer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  linkText: {
    color: '#3dbac6',
    fontWeight: '500',
  },
});
