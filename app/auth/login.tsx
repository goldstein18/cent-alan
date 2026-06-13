import { Ionicons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

interface LoginProps {
  onBack?: () => void;
  onForgotPassword?: () => void;
}

export default function Login({ onBack, onForgotPassword }: LoginProps) {
  const { login, user, isLoggedIn, restoreSession } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const phoneRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      
      if (hasHardware && isEnrolled) {
        setBiometricAvailable(true);
        
        // Determine biometric type
        if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Face ID');
        } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Touch ID');
        } else {
          setBiometricType('Biométrico');
        }
      }
    } catch (error) {
    }
  };

  const handleLogin = async () => {
    if (!phoneNumber || !password) {
      Alert.alert('Error', 'Por favor ingresa tu número de teléfono y contraseña');
      return;
    }

    setLoading(true);
    
    try {
      const result = await login(phoneNumber, password);
      
      if (result.success) {
        // La navegación se manejará automáticamente por el cambio de estado isLoggedIn
      } else {
        Alert.alert('Error', result.error || 'Credenciales inválidas');
      }
    } catch (error) {
      Alert.alert('Error', 'Hubo un problema al iniciar sesión. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  const handleBiometricLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Usar ${biometricType} para iniciar sesión`,
        fallbackLabel: 'Usar contraseña',
        cancelLabel: 'Cancelar',
      });

      if (result.success) {
        setLoading(true);
        try {
          const { AuthService } = await import('../services/authService');
          const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;

          // Inicializar AuthService para cargar tokens
          await AuthService.initialize();
          let isAuth = await AuthService.isAuthenticated();

          // Si no hay sesión activa (ej. después de logout), intentar con el
          // biometricRefreshToken que se guardó al cerrar sesión
          if (!isAuth) {
            const biometricToken = await AsyncStorage.getItem('biometricRefreshToken');
            if (biometricToken) {
              (AuthService as any).refreshToken = biometricToken;
              const refreshResult = await AuthService.refreshAccessToken();
              if (refreshResult.success) {
                isAuth = true;
              }
            }
          }

          if (isAuth) {
            // Refrescar token y restaurar sesión
            await AuthService.refreshAccessToken();
            await restoreSession();

            setLoading(false);
            setTimeout(() => {
              router.replace('/(tabs)');
            }, 100);
          } else {
            setLoading(false);
            Alert.alert('Información', 'Por favor, inicia sesión con tu número de teléfono y contraseña la primera vez.');
          }
        } catch (error) {
          console.error('Error en biometric login:', error);
          setLoading(false);
          Alert.alert('Error', 'No se pudo verificar la sesión guardada. Por favor, inicia sesión manualmente.');
        }
      } else if (result.error && result.error.toString().includes('UserCancel')) {
        // User cancelled, do nothing
      } else {
        Alert.alert('Error', 'No se pudo autenticar con ' + biometricType);
      }
    } catch (error) {
      console.error('Error al usar biometric:', error);
      Alert.alert('Error', 'Error al usar ' + biometricType);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#3dbac6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Iniciar sesión</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Image 
            source={require('../../assets/images/iconremove.png')} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>¡Bienvenido de vuelta!</Text>
        <Text style={styles.subtitle}>Ingresa tu número de teléfono y contraseña para continuar</Text>

        <View style={styles.form}>
          <Pressable style={styles.inputContainer} onPress={() => phoneRef.current?.focus()}>
            <Text style={styles.label}>Número de teléfono</Text>
            <TextInput
              ref={phoneRef}
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="55 1234 5678"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              editable={true}
            />
          </Pressable>

          <Pressable style={styles.inputContainer} onPress={() => passwordRef.current?.focus()}>
            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.passwordInputContainer}>
              <TextInput
                ref={passwordRef}
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Tu contraseña"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                editable={true}
              />
              <TouchableOpacity 
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons 
                  name={showPassword ? "eye-off-outline" : "eye-outline"} 
                  size={24} 
                  color="#999" 
                />
              </TouchableOpacity>
            </View>
          </Pressable>

          <TouchableOpacity style={styles.forgotPassword} onPress={onForgotPassword}>
            <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.loginButton, loading && styles.loginButtonDisabled]} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <Text style={styles.loginButtonText}>Iniciando sesión...</Text>
            ) : (
              <Text style={styles.loginButtonText}>Iniciar sesión</Text>
            )}
          </TouchableOpacity>
        </View>

        {biometricAvailable && (
          <>
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.biometricContainer}>
              <TouchableOpacity 
                style={styles.biometricButton} 
                onPress={handleBiometricLogin}
                disabled={loading}
              >
                <View style={styles.biometricIconContainer}>
                  <Ionicons 
                    name={biometricType === 'Face ID' ? 'scan-outline' : 'finger-print-outline'} 
                    size={28} 
                    color="#3dbac6" 
                  />
                </View>
                <View style={styles.biometricTextContainer}>
                  <Text style={styles.biometricButtonText}>
                    Usar {biometricType}
                  </Text>
                  <Text style={styles.biometricSubText}>
                    Iniciar sesión de forma rápida y segura
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#3dbac6" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>


    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3dbac6',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#3dbac6',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 40,
  },
  form: {
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    letterSpacing: 0,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
    letterSpacing: 0,
  },
  eyeIcon: {
    paddingHorizontal: 12,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#3dbac6',
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    backgroundColor: '#3dbac6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E5E5',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#666',
    fontSize: 14,
  },
  biometricContainer: {
    marginBottom: 20,
  },
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  biometricIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#F0F4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  biometricTextContainer: {
    flex: 1,
  },
  biometricButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3dbac6',
    marginBottom: 2,
  },
  biometricSubText: {
    fontSize: 14,
    color: '#666',
  },

});
