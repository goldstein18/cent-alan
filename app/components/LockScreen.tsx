import * as LocalAuthentication from 'expo-local-authentication';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface LockScreenProps {
  onUnlock: () => Promise<boolean>;
  onLogout: () => void;
}

export function LockScreen({ onUnlock, onLogout }: LockScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [biometricType, setBiometricType] = useState<'face' | 'fingerprint' | 'none'>('none');

  useEffect(() => {
    (async () => {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricType('face');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricType('fingerprint');
      }
    })();
  }, []);

  // Intentar desbloqueo automático al mostrar la pantalla
  useEffect(() => {
    handleUnlock();
  }, []);

  const handleUnlock = async () => {
    setLoading(true);
    setError('');
    const success = await onUnlock();
    if (!success) {
      setError('No se pudo verificar tu identidad. Inténtalo de nuevo.');
    }
    setLoading(false);
  };

  const biometricLabel =
    biometricType === 'face'
      ? 'Desbloquear con Face ID'
      : biometricType === 'fingerprint'
      ? 'Desbloquear con Touch ID'
      : 'Desbloquear';

  const biometricIcon =
    biometricType === 'face' ? '🔒' : biometricType === 'fingerprint' ? '👆' : '🔒';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Image
          source={require('../../assets/images/iconremove.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>Sesión bloqueada</Text>
        <Text style={styles.subtitle}>
          Tu sesión se bloqueó por inactividad.{'\n'}Verifica tu identidad para continuar.
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color="#3dbac6" style={styles.loader} />
        ) : (
          <TouchableOpacity style={styles.unlockButton} onPress={handleUnlock} activeOpacity={0.8}>
            <Text style={styles.unlockIcon}>{biometricIcon}</Text>
            <Text style={styles.unlockText}>{biometricLabel}</Text>
          </TouchableOpacity>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F7',
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 60,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
  },
  loader: {
    marginVertical: 24,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3dbac6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    shadowColor: '#3dbac6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    gap: 10,
  },
  unlockIcon: {
    fontSize: 22,
  },
  unlockText: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    color: '#e74c3c',
    textAlign: 'center',
  },
  logoutButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoutText: {
    fontSize: 15,
    color: '#999',
    textDecorationLine: 'underline',
  },
});
