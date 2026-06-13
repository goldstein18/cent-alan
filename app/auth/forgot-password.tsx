import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { AuthService } from '../services/authService';

type Step = 1 | 2 | 3;

const OTP_LENGTH = 6;
const OTP_VALID_SECONDS = 600;
const RESEND_COOLDOWN_SECONDS = 30;

interface ForgotPasswordProps {
  onBack?: () => void;
  onSuccess?: () => void;
}

function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return d;
  return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
}

function mapResetPasswordError(message?: string): string {
  const m = (message || '').toLowerCase();
  if (m.includes('expirado') || m.includes('expired')) {
    return 'El código expiró. Vuelve al paso anterior y pulsa «Reenviar código».';
  }
  if (m.includes('inválido') || m.includes('invalid') || m.includes('incorrecto')) {
    return 'El código no es correcto. Revisa el SMS o solicita uno nuevo.';
  }
  if (m.includes('no se encontró') || m.includes('not found')) {
    return 'No hay cuenta con ese número. Verifica el teléfono o regístrate.';
  }
  return message || 'No se pudo actualizar la contraseña. Intenta de nuevo.';
}

export default function ForgotPassword({ onBack, onSuccess }: ForgotPasswordProps) {
  const [step, setStep] = useState<Step>(1);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpSentAt, setOtpSentAt] = useState<number | null>(null);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(OTP_VALID_SECONDS);
  const [stepError, setStepError] = useState<string | null>(null);

  const otpRefs = useRef<(TextInput | null)[]>(Array(OTP_LENGTH).fill(null));

  const cleanPhone = phone.replace(/\D/g, '');
  const phoneDisplay = formatPhoneDisplay(cleanPhone);
  const otpCode = otp.join('');
  const passwordLongEnough = newPassword.length >= 6;
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canSavePassword = passwordLongEnough && passwordsMatch && !loading;

  useEffect(() => {
    if (resendCooldown > 0) {
      const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (step !== 2 && step !== 3) return;
    if (!otpSentAt) return;

    const tick = () => {
      const elapsed = Math.floor((Date.now() - otpSentAt) / 1000);
      setOtpSecondsLeft(Math.max(0, OTP_VALID_SECONDS - elapsed));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [otpSentAt, step]);

  const markOtpSent = () => {
    setOtpSentAt(Date.now());
    setOtpSecondsLeft(OTP_VALID_SECONDS);
  };

  const goToPasswordStep = () => {
    if (otpCode.length !== OTP_LENGTH) return;
    setStepError(null);
    setStep(3);
  };

  // ── Step 1: send OTP ────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (cleanPhone.length !== 10) {
      setStepError('Ingresa un número de teléfono de 10 dígitos');
      return;
    }
    setStepError(null);
    setLoading(true);
    try {
      const result = await AuthService.sendOtp(cleanPhone);
      if (result.success) {
        setOtp(Array(OTP_LENGTH).fill(''));
        markOtpSent();
        setStep(2);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        setStepError(result.error || 'No se pudo enviar el código. Intenta de nuevo.');
      }
    } catch {
      setStepError('No se pudo enviar el código. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setStepError(null);
    setLoading(true);
    try {
      const result = await AuthService.sendOtp(cleanPhone);
      if (result.success) {
        setOtp(Array(OTP_LENGTH).fill(''));
        markOtpSent();
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        otpRefs.current[0]?.focus();
      } else {
        setStepError(result.error || 'No se pudo reenviar el código.');
      }
    } catch {
      setStepError('No se pudo reenviar el código.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: collect OTP (validated once on reset-password) ─────────────────
  const handleContinueFromOtp = () => {
    if (otpCode.length !== OTP_LENGTH) {
      setStepError('Ingresa el código completo de 6 dígitos.');
      return;
    }
    if (otpSecondsLeft <= 0) {
      setStepError('El código expiró. Pulsa «Reenviar código».');
      return;
    }
    goToPasswordStep();
  };

  // ── Step 3: reset password (single OTP verification) ───────────────────────
  const handleResetPassword = async () => {
    if (!passwordLongEnough) {
      setStepError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (!passwordsMatch) {
      setStepError('Las contraseñas no coinciden.');
      return;
    }
    if (otpCode.length !== OTP_LENGTH) {
      setStepError('Falta el código SMS. Vuelve al paso anterior.');
      return;
    }
    if (otpSecondsLeft <= 0) {
      setStepError('El código expiró. Vuelve atrás y reenvía un código nuevo.');
      return;
    }

    setStepError(null);
    setLoading(true);
    try {
      const result = await AuthService.resetPassword(cleanPhone, otpCode, newPassword);
      if (result.success) {
        Alert.alert(
          '¡Listo!',
          'Tu contraseña fue actualizada. Inicia sesión con tu nueva contraseña.',
          [{ text: 'Ir al login', onPress: () => onSuccess?.() }]
        );
      } else {
        setStepError(mapResetPasswordError(result.error));
      }
    } catch {
      setStepError('No se pudo actualizar la contraseña. Verifica tu conexión.');
    } finally {
      setLoading(false);
    }
  };

  // ── OTP input helpers ───────────────────────────────────────────────────────
  const handleOtpChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, '');
    setStepError(null);

    if (digits.length > 1) {
      const spread = digits.slice(0, OTP_LENGTH).split('');
      const next = Array(OTP_LENGTH).fill('');
      spread.forEach((d, i) => {
        next[i] = d;
      });
      setOtp(next);
      if (spread.length >= OTP_LENGTH) {
        setTimeout(() => setStep(3), 0);
      } else if (spread.length > 0) {
        otpRefs.current[spread.length]?.focus();
      }
      return;
    }

    const next = [...otp];
    next[index] = digits.slice(0, 1);
    setOtp(next);
    if (digits !== '' && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
    if (next.join('').length === OTP_LENGTH) {
      setTimeout(() => setStep(3), 0);
    }
  };

  const handleOtpKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && otp[index] === '' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleBack = () => {
    setStepError(null);
    if (step > 1) {
      if (step === 2) {
        setOtp(Array(OTP_LENGTH).fill(''));
        setOtpSentAt(null);
      }
      setStep((s) => (s - 1) as Step);
    } else {
      onBack?.();
    }
  };

  const formatCountdown = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const stepTitles: Record<Step, string> = {
    1: 'Ingresa tu teléfono',
    2: 'Ingresa el código',
    3: 'Nueva contraseña',
  };

  const stepSubtitles: Record<Step, string> = {
    1: 'Te enviaremos un código por SMS para verificar tu identidad',
    2:
      cleanPhone.length === 10
        ? `Código enviado a ${phoneDisplay}. Lo confirmaremos al guardar tu nueva contraseña.`
        : 'Ingresa el código de 6 dígitos de tu SMS',
    3:
      cleanPhone.length === 10
        ? `Si el código para ${phoneDisplay} ya no sirve, vuelve atrás y reenvía uno nuevo.`
        : 'Elige una nueva contraseña segura',
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#3dbac6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recuperar contraseña</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.stepIndicator}>
        {[1, 2, 3].map((s) => (
          <View key={s} style={[styles.stepDot, step >= s && styles.stepDotActive]} />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{stepTitles[step]}</Text>
        <Text style={styles.subtitle}>{stepSubtitles[step]}</Text>

        {stepError ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={20} color="#B42318" />
            <Text style={styles.errorBannerText}>{stepError}</Text>
          </View>
        ) : null}

        {step === 1 && (
          <View style={styles.form}>
            <Text style={styles.label}>Número de teléfono</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={(v) => {
                setPhone(v);
                setStepError(null);
              }}
              placeholder="55 1234 5678"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              maxLength={10}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleSendOtp}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Enviando...' : 'Enviar código'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.form}>
            {otpSentAt ? (
              <Text
                style={[
                  styles.otpTimer,
                  otpSecondsLeft <= 60 && styles.otpTimerWarning,
                ]}
              >
                {otpSecondsLeft > 0
                  ? `El código vence en ${formatCountdown(otpSecondsLeft)}`
                  : 'El código expiró. Reenvía uno nuevo.'}
              </Text>
            ) : null}

            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(el) => {
                    otpRefs.current[index] = el;
                  }}
                  style={styles.otpInput}
                  value={digit}
                  onChangeText={(v) => handleOtpChange(index, v)}
                  onKeyPress={({ nativeEvent }) => handleOtpKeyPress(index, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={index === 0 ? OTP_LENGTH : 1}
                  textContentType={index === 0 ? 'oneTimeCode' : 'none'}
                  autoComplete={index === 0 ? 'sms-otp' : 'off'}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.resendButton, resendCooldown > 0 && styles.resendButtonDisabled]}
              onPress={handleResend}
              disabled={resendCooldown > 0 || loading}
            >
              <Text style={styles.resendButtonText}>
                {resendCooldown > 0 ? `Reenviar en ${resendCooldown}s` : 'Reenviar código'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                (loading || otpCode.length !== OTP_LENGTH) && styles.buttonDisabled,
              ]}
              onPress={handleContinueFromOtp}
              disabled={loading || otpCode.length !== OTP_LENGTH}
            >
              <Text style={styles.primaryButtonText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.form}>
            <Text style={styles.label}>Nueva contraseña</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={newPassword}
                onChangeText={(v) => {
                  setNewPassword(v);
                  setStepError(null);
                }}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#999"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color="#999"
                />
              </TouchableOpacity>
            </View>

            <View style={styles.checklist}>
              <Text
                style={[
                  styles.checklistItem,
                  passwordLongEnough && styles.checklistItemOk,
                ]}
              >
                {passwordLongEnough ? '✓' : '○'} Mínimo 6 caracteres
              </Text>
              <Text
                style={[
                  styles.checklistItem,
                  passwordsMatch && confirmPassword.length > 0 && styles.checklistItemOk,
                ]}
              >
                {passwordsMatch && confirmPassword.length > 0 ? '✓' : '○'} Las contraseñas coinciden
              </Text>
            </View>

            <Text style={[styles.label, { marginTop: 16 }]}>Confirmar contraseña</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={styles.passwordInput}
                value={confirmPassword}
                onChangeText={(v) => {
                  setConfirmPassword(v);
                  setStepError(null);
                }}
                placeholder="Repite tu contraseña"
                placeholderTextColor="#999"
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowConfirm(!showConfirm)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showConfirm ? 'eye-off-outline' : 'eye-outline'}
                  size={22}
                  color="#999"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                { marginTop: 32 },
                !canSavePassword && styles.buttonDisabled,
              ]}
              onPress={handleResetPassword}
              disabled={!canSavePassword}
            >
              <Text style={styles.primaryButtonText}>
                {loading ? 'Guardando...' : 'Guardar contraseña'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  backButton: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#3dbac6' },
  placeholder: { width: 40 },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0E0',
  },
  stepDotActive: {
    backgroundColor: '#3dbac6',
    width: 24,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 24,
    lineHeight: 22,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FEF3F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECDCA',
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#B42318',
    lineHeight: 20,
  },
  form: { width: '100%' },
  label: {
    fontSize: 15,
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
    marginBottom: 24,
  },
  otpTimer: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  otpTimerWarning: {
    color: '#B54708',
    fontWeight: '500',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  otpInput: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  resendButton: {
    alignSelf: 'center',
    marginBottom: 24,
    paddingVertical: 8,
  },
  resendButtonDisabled: { opacity: 0.4 },
  resendButtonText: {
    color: '#3dbac6',
    fontSize: 14,
    fontWeight: '500',
  },
  checklist: {
    marginTop: 12,
    gap: 6,
  },
  checklistItem: {
    fontSize: 13,
    color: '#888',
  },
  checklistItemOk: {
    color: '#067647',
    fontWeight: '500',
  },
  passwordContainer: {
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
  },
  eyeIcon: { paddingHorizontal: 12 },
  primaryButton: {
    backgroundColor: '#3dbac6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
