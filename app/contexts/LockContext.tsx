import * as LocalAuthentication from 'expo-local-authentication';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

const LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutos

interface LockContextType {
  isLocked: boolean;
  resetTimer: () => void;
  lockApp: () => void;
  unlockWithBiometrics: () => Promise<boolean>;
}

const LockContext = createContext<LockContextType | undefined>(undefined);

export function LockProvider({
  children,
  isLoggedIn,
  onFullLogout,
}: {
  children: React.ReactNode;
  isLoggedIn: boolean;
  onFullLogout: () => void;
}) {
  const [isLocked, setIsLocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setIsLocked(true);
    }, LOCK_TIMEOUT_MS);
  }, [clearTimer]);

  // Resetear timer en cualquier interacción del usuario
  const resetTimer = useCallback(() => {
    if (!isLoggedIn || isLocked) return;
    startTimer();
  }, [isLoggedIn, isLocked, startTimer]);

  const lockApp = useCallback(() => {
    clearTimer();
    setIsLocked(true);
  }, [clearTimer]);

  const unlockWithBiometrics = useCallback(async (): Promise<boolean> => {
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        // Sin biometría disponible → permitir acceso directo o mostrar PIN
        setIsLocked(false);
        startTimer();
        return true;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Verifica tu identidad para continuar',
        fallbackLabel: 'Usar contraseña',
        cancelLabel: 'Cerrar sesión',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLocked(false);
        startTimer();
        return true;
      }

      // Si el usuario canceló con "Cerrar sesión"
      if (result.error === 'user_cancel' || result.error === 'system_cancel') {
        onFullLogout();
      }

      return false;
    } catch {
      return false;
    }
  }, [startTimer, onFullLogout]);

  // Iniciar timer cuando el usuario inicia sesión
  useEffect(() => {
    if (isLoggedIn) {
      setIsLocked(false);
      startTimer();
    } else {
      clearTimer();
      setIsLocked(false);
    }
    return clearTimer;
  }, [isLoggedIn, startTimer, clearTimer]);

  // Bloquear cuando la app va a segundo plano
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (
        isLoggedIn &&
        (prev === 'active') &&
        (nextState === 'background' || nextState === 'inactive')
      ) {
        lockApp();
      }
    });
    return () => sub.remove();
  }, [isLoggedIn, lockApp]);

  return (
    <LockContext.Provider value={{ isLocked, resetTimer, lockApp, unlockWithBiometrics }}>
      {children}
    </LockContext.Provider>
  );
}

export function useLock() {
  const ctx = useContext(LockContext);
  if (!ctx) throw new Error('useLock must be used inside LockProvider');
  return ctx;
}
