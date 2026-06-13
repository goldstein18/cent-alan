import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
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
import { useAuth } from '../contexts/AuthContext';
import { AuthService } from '../services/authService';

interface WizardData {
  phone: string;
  email: string;
  otp: string[];
  firstName: string;
  lastName: string;
  secondLastName: string;
  birthDate: string;
  gender: string;
  otherGender: string;
  street: string;
  exteriorNumber: string;
  interiorNumber: string;
  neighborhood: string;
  postalCode: string;
  city: string;
  state: string;
  password: string;
  confirmPassword: string;
  pin: string[];
  confirmPin: string[];
  ineFront: any;
  ineBack: any;
  referralCode: string;
}

interface SignupWizardProps {
  onBack?: () => void;
}

export default function SignupWizard({ onBack }: SignupWizardProps) {
  const { login, restoreSession } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<any>(null);
  const [wizardData, setWizardData] = useState<WizardData>({
    phone: '',
    email: '',
    otp: ['', '', '', '', '', ''],
    firstName: '',
    lastName: '',
    secondLastName: '',
    birthDate: '',
    gender: '',
    otherGender: '',
    street: '',
    exteriorNumber: '',
    interiorNumber: '',
    neighborhood: '',
    postalCode: '',
    city: '',
    state: '',
    password: '',
    confirmPassword: '',
    pin: ['', '', '', ''],
    confirmPin: ['', '', '', ''],
    ineFront: null,
    ineBack: null,
    referralCode: '',
  });

  const [errors, setErrors] = useState<Partial<WizardData>>({});
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Refs for OTP and PIN auto-advance
  const otpRefs = useRef<(TextInput | null)[]>([null, null, null, null, null, null]);
  const pinRefs = useRef<(TextInput | null)[]>([null, null, null, null]);
  const confirmPinRefs = useRef<(TextInput | null)[]>([null, null, null, null]);

  const totalSteps = 9;

  // OTP resend cooldown
  useEffect(() => {
    if (otpResendCooldown > 0) {
      const timer = setTimeout(() => setOtpResendCooldown(otpResendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpResendCooldown]);

  // Password strength calculation
  useEffect(() => {
    const password = wizardData.password;
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    setPasswordStrength(strength);
  }, [wizardData.password]);

  const updateWizardData = (field: keyof WizardData, value: any) => {
    setWizardData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<WizardData> = {};

    switch (step) {
      case 1:
        if (!wizardData.phone || wizardData.phone.length !== 10) {
          newErrors.phone = 'El teléfono debe tener 10 dígitos';
        }
        if (!wizardData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wizardData.email)) {
          newErrors.email = 'Ingresa un correo electrónico válido';
        }
        break;

      case 2:
        if (wizardData.otp.join('').length !== 6) {
          (newErrors as any).otp = 'Ingresa el código de 6 dígitos';
        }
        break;

      case 3:
        if (!wizardData.firstName.trim()) {
          newErrors.firstName = 'El nombre es requerido';
        }
        if (!wizardData.lastName.trim()) {
          newErrors.lastName = 'El primer apellido es requerido';
        }
        break;

      case 4:
        if (!wizardData.birthDate) {
          newErrors.birthDate = 'La fecha de nacimiento es requerida';
        } else {
          const birthDate = new Date(wizardData.birthDate);
          const today = new Date();
          const age = today.getFullYear() - birthDate.getFullYear();
          if (age < 18) {
            newErrors.birthDate = 'Debes ser mayor de 18 años';
          }
        }
        break;

      case 5:
        if (!wizardData.gender) {
          newErrors.gender = 'Selecciona tu género';
        }
        if (wizardData.gender === 'Otro' && !wizardData.otherGender.trim()) {
          newErrors.otherGender = 'Especifica tu género';
        }
        break;

      case 6:
        if (!wizardData.street.trim()) newErrors.street = 'La calle es requerida';
        if (!wizardData.exteriorNumber.trim()) newErrors.exteriorNumber = 'El número exterior es requerido';
        if (!wizardData.neighborhood.trim()) newErrors.neighborhood = 'La colonia es requerida';
        if (!wizardData.postalCode.trim() || wizardData.postalCode.length !== 5) {
          newErrors.postalCode = 'El código postal debe tener 5 dígitos';
        }
        if (!wizardData.city.trim()) newErrors.city = 'La ciudad es requerida';
        if (!wizardData.state.trim()) newErrors.state = 'El estado es requerido';
        break;

      case 7:
        if (wizardData.password.length < 8) {
          newErrors.password = 'La contraseña debe tener al menos 8 caracteres';
        } else if (passwordStrength < 3) {
          newErrors.password = 'La contraseña debe ser más segura';
        }
        if (wizardData.password !== wizardData.confirmPassword) {
          newErrors.confirmPassword = 'Las contraseñas no coinciden';
        }
        break;

      case 8:
        if (wizardData.pin.join('').length !== 4) {
          (newErrors as any).pin = 'Ingresa un PIN de 4 dígitos';
        }
        if (wizardData.confirmPin.join('').length !== 4) {
          (newErrors as any).confirmPin = 'Confirma tu PIN de 4 dígitos';
        }
        if (wizardData.pin.join('') !== wizardData.confirmPin.join('')) {
          (newErrors as any).confirmPin = 'Los PINs no coinciden';
        }
        break;

      case 9:
        // INE uploads are now optional, so no validation errors here
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    
    if (validateStep(currentStep)) {
      if (currentStep === 1) {
        // Send OTP via backend API
        try {
          const phoneNumber = wizardData.phone;
          const email = wizardData.email;
          
          
          const result = await AuthService.sendOtp(phoneNumber, email);
          
          if (result.success) {
            setConfirmationResult({ verificationId: 'otp-sent' });
            setCurrentStep(currentStep + 1);
            Alert.alert('Código enviado', 'Se ha enviado un código de verificación a tu teléfono.');
          } else {
            Alert.alert(
              'Error',
              result.error || 'No se pudo enviar el código de verificación. Por favor, intenta de nuevo.',
              [{ text: 'OK' }]
            );
          }
        } catch (error: any) {
          console.error('Error sending OTP:', error);
          Alert.alert(
            'Error',
            'No se pudo enviar el código de verificación. Por favor, verifica tu conexión e intenta de nuevo.',
            [{ text: 'OK' }]
          );
        }
      } else if (currentStep === 2) {
        // OTP se valida una sola vez al crear la cuenta (signup), no aquí
        const otpCode = wizardData.otp.join('');
        if (otpCode.length !== 6) {
          Alert.alert('Error', 'Por favor ingresa el código completo de 6 dígitos.');
          return;
        }
        setCurrentStep(currentStep + 1);
      } else if (currentStep === totalSteps) {
        // Final step - Create account via signup endpoint
        try {
          const otpCode = wizardData.otp.join('');
          
          if (otpCode.length !== 6) {
            Alert.alert('Error', 'Por favor verifica tu código OTP antes de continuar.');
            return;
          }

          
          const signupResult = await AuthService.signup({
            phoneNumber: wizardData.phone,
            email: wizardData.email,
            firstName: wizardData.firstName,
            lastName: wizardData.lastName,
            secondLastName: wizardData.secondLastName,
            birthDate: wizardData.birthDate,
            gender: wizardData.gender,
            street: wizardData.street,
            exteriorNumber: wizardData.exteriorNumber,
            interiorNumber: wizardData.interiorNumber,
            neighborhood: wizardData.neighborhood,
            postalCode: wizardData.postalCode,
            city: wizardData.city,
            state: wizardData.state,
            password: wizardData.password,
            otp: otpCode,
            referredBy: wizardData.referralCode || undefined,
          });

          if (signupResult.success) {
            // Los tokens ya se guardaron en signup(). Activamos la sesión para que
            // _layout renderice las tabs (isLoggedIn=true). NO usar router.replace:
            // el stack de (tabs) aún no está montado y provoca un crash.
            await restoreSession();
            Alert.alert(
              '¡Cuenta creada exitosamente!',
              'Tu cuenta ha sido creada y estás autenticado.',
              [{ text: 'Continuar' }]
            );
          } else {
            Alert.alert('Error', signupResult.error || 'No se pudo crear la cuenta. Por favor, intenta de nuevo.');
          }
        } catch (error: any) {
          console.error('Error creating account:', error);
          Alert.alert('Error', 'No se pudo crear la cuenta. Por favor, intenta de nuevo.');
        }
      } else {
        setCurrentStep(currentStep + 1);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      // Clear OTP when going back to step 1 so a stale code isn't reused
      if (currentStep === 2) {
        setWizardData(prev => ({ ...prev, otp: ['', '', '', '', '', ''] }));
      }
      setCurrentStep(currentStep - 1);
    } else {
      if (onBack) {
        onBack();
      } else {
        router.back();
      }
    }
  };

  const handleResendOTP = async () => {
    try {
      const phoneNumber = wizardData.phone;
      const email = wizardData.email;
      
      
      const result = await AuthService.sendOtp(phoneNumber, email);
      
      if (result.success) {
        setConfirmationResult({ verificationId: 'otp-sent' });
        setOtpResendCooldown(30);
        Alert.alert('Código enviado', 'Se ha enviado un nuevo código a tu teléfono.');
      } else {
        Alert.alert('Error', result.error || 'No se pudo enviar el código. Por favor, intenta de nuevo.');
      }
    } catch (error: any) {
      console.error('Error resending OTP:', error);
      Alert.alert('Error', 'No se pudo enviar el código. Por favor, verifica tu conexión e intenta de nuevo.');
    }
  };

  const handleOTPChange = (index: number, value: string) => {
    const clean = value.replace(/\D/g, '').slice(0, 1);
    const newOtp = [...wizardData.otp];
    newOtp[index] = clean;
    setWizardData(prev => ({ ...prev, otp: newOtp }));
    if (clean !== '' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOTPKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && wizardData.otp[index] === '' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handlePINChange = (index: number, value: string, type: 'pin' | 'confirmPin') => {
    const newPin = [...wizardData[type]];
    newPin[index] = value;
    setWizardData(prev => ({ ...prev, [type]: newPin }));
    // Auto-advance to next field when a digit is entered
    if (value !== '') {
      const refs = type === 'pin' ? pinRefs : confirmPinRefs;
      if (index < 3) {
        refs.current[index + 1]?.focus();
      }
    }
  };

  const handlePINKeyPress = (index: number, key: string, type: 'pin' | 'confirmPin') => {
    // Go back to previous field on backspace if current field is empty
    if (key === 'Backspace' && wizardData[type][index] === '' && index > 0) {
      const refs = type === 'pin' ? pinRefs : confirmPinRefs;
      refs.current[index - 1]?.focus();
    }
  };

  const handleDateChange = (text: string) => {
    // Remove all non-numeric characters
    const numbers = text.replace(/\D/g, '');
    
    // Format as DD/MM/YYYY while typing
    let formatted = '';
    if (numbers.length > 0) {
      formatted = numbers.substring(0, 2);
      if (numbers.length > 2) {
        formatted += '/' + numbers.substring(2, 4);
      }
      if (numbers.length > 4) {
        formatted += '/' + numbers.substring(4, 8);
      }
    }
    
    updateWizardData('birthDate', formatted);
  };

  const handlePostalCodeChange = async (text: string) => {
    updateWizardData('postalCode', text);
    if (text.length === 5) {
      // Mock API call to get city and state
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        updateWizardData('city', 'Ciudad de México');
        updateWizardData('state', 'CDMX');
      } catch (error) {
      }
    }
  };

  const handleFileUpload = async (type: 'front' | 'back') => {
    try {
      // Request permissions first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permisos requeridos', 'Necesitamos acceso a tu galería para seleccionar la foto.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        
        // Validar el peso REAL del archivo (no los píxeles sin comprimir)
        const fileSizeMB = (asset.fileSize ?? 0) / 1024 / 1024;
        if (asset.fileSize && fileSizeMB > 10) {
          Alert.alert('Error', 'La imagen es demasiado grande. Máximo 10MB.');
          return;
        }
        
        updateWizardData(type === 'front' ? 'ineFront' : 'ineBack', asset);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo seleccionar la imagen.');
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${(currentStep / totalSteps) * 100}%` }]} />
      </View>
      <Text style={styles.progressText}>
        Paso {currentStep} de {totalSteps}
      </Text>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Teléfono y correo</Text>
      <Text style={styles.stepSubtitle}>Necesitamos esta información para contactarte</Text>
      

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Teléfono</Text>
        <View style={styles.phoneInputContainer}>
          <View style={styles.countryCode}>
            <Text style={styles.countryCodeText}>+52</Text>
          </View>
          <TextInput
            style={[styles.input, styles.phoneInput]}
            value={wizardData.phone}
            onChangeText={(text) => updateWizardData('phone', text.replace(/\D/g, ''))}
            placeholder="10 dígitos"
            keyboardType="phone-pad"
            maxLength={10}
          />
        </View>
        {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Correo electrónico</Text>
        <TextInput
          style={styles.input}
          value={wizardData.email}
          onChangeText={(text) => updateWizardData('email', text)}
          placeholder="tu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Verificación</Text>
      <Text style={styles.stepSubtitle}>Ingresa el código de 6 dígitos enviado a tu teléfono</Text>

      <View style={styles.otpContainer}>
        {wizardData.otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={el => { otpRefs.current[index] = el; }}
            style={styles.otpInput}
            value={digit}
            onChangeText={(value) => handleOTPChange(index, value)}
            onKeyPress={({ nativeEvent }) => handleOTPKeyPress(index, nativeEvent.key)}
            keyboardType="numeric"
            maxLength={1}
          />
        ))}
      </View>
      {(errors as any).otp && <Text style={styles.errorText}>{(errors as any).otp}</Text>}

      <TouchableOpacity
        style={[styles.resendButton, otpResendCooldown > 0 && styles.resendButtonDisabled]}
        onPress={handleResendOTP}
        disabled={otpResendCooldown > 0}
      >
        <Text style={styles.resendButtonText}>
          {otpResendCooldown > 0 ? `Reenviar en ${otpResendCooldown}s` : 'Reenviar código'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Información personal</Text>
      <Text style={styles.stepSubtitle}>Cuéntanos sobre ti</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Nombre(s)</Text>
        <TextInput
          style={styles.input}
          value={wizardData.firstName}
          onChangeText={(text) => updateWizardData('firstName', text)}
          placeholder="Tu nombre"
        />
        {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Primer apellido</Text>
        <TextInput
          style={styles.input}
          value={wizardData.lastName}
          onChangeText={(text) => updateWizardData('lastName', text)}
          placeholder="Tu primer apellido"
        />
        {errors.lastName && <Text style={styles.errorText}>{errors.lastName}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Segundo apellido (opcional)</Text>
        <TextInput
          style={styles.input}
          value={wizardData.secondLastName}
          onChangeText={(text) => updateWizardData('secondLastName', text)}
          placeholder="Tu segundo apellido"
        />
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Fecha de nacimiento</Text>
      <Text style={styles.stepSubtitle}>Debes ser mayor de 18 años</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Fecha de nacimiento</Text>
        <TextInput
          style={styles.input}
          value={wizardData.birthDate}
          onChangeText={handleDateChange}
          placeholder="DD/MM/AAAA"
          keyboardType="numeric"
          maxLength={10}
        />
        {errors.birthDate && <Text style={styles.errorText}>{errors.birthDate}</Text>}
      </View>
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Género</Text>
      <Text style={styles.stepSubtitle}>Esta información es opcional</Text>

      {['Masculino', 'Femenino', 'Prefiero no decir', 'Otro'].map((option) => (
        <TouchableOpacity
          key={option}
          style={[
            styles.radioOption,
            wizardData.gender === option && styles.radioOptionSelected
          ]}
          onPress={() => updateWizardData('gender', option)}
        >
          <View style={[
            styles.radioButton,
            wizardData.gender === option && styles.radioButtonSelected
          ]}>
            {wizardData.gender === option && <View style={styles.radioButtonInner} />}
          </View>
          <Text style={styles.radioText}>{option}</Text>
        </TouchableOpacity>
      ))}

      {wizardData.gender === 'Otro' && (
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Especifica tu género</Text>
          <TextInput
            style={styles.input}
            value={wizardData.otherGender}
            onChangeText={(text) => updateWizardData('otherGender', text)}
            placeholder="Especifica tu género"
          />
          {errors.otherGender && <Text style={styles.errorText}>{errors.otherGender}</Text>}
        </View>
      )}
    </View>
  );

  const renderStep6 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Dirección</Text>
      <Text style={styles.stepSubtitle}>Necesitamos tu dirección para verificación</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Calle</Text>
        <TextInput
          style={styles.input}
          value={wizardData.street}
          onChangeText={(text) => updateWizardData('street', text)}
          placeholder="Nombre de la calle"
        />
        {errors.street && <Text style={styles.errorText}>{errors.street}</Text>}
      </View>

      <View style={styles.row}>
        <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Número exterior</Text>
          <TextInput
            style={styles.input}
            value={wizardData.exteriorNumber}
            onChangeText={(text) => updateWizardData('exteriorNumber', text)}
            placeholder="123"
          />
          {errors.exteriorNumber && <Text style={styles.errorText}>{errors.exteriorNumber}</Text>}
        </View>

        <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Número interior (opcional)</Text>
          <TextInput
            style={styles.input}
            value={wizardData.interiorNumber}
            onChangeText={(text) => updateWizardData('interiorNumber', text)}
            placeholder="A"
          />
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Colonia</Text>
        <TextInput
          style={styles.input}
          value={wizardData.neighborhood}
          onChangeText={(text) => updateWizardData('neighborhood', text)}
          placeholder="Nombre de la colonia"
        />
        {errors.neighborhood && <Text style={styles.errorText}>{errors.neighborhood}</Text>}
      </View>

      <View style={styles.row}>
        <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.label}>Código postal</Text>
          <TextInput
            style={styles.input}
            value={wizardData.postalCode}
            onChangeText={handlePostalCodeChange}
            placeholder="12345"
            keyboardType="numeric"
            maxLength={5}
          />
          {errors.postalCode && <Text style={styles.errorText}>{errors.postalCode}</Text>}
        </View>

        <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
          <Text style={styles.label}>Ciudad</Text>
          <TextInput
            style={styles.input}
            value={wizardData.city}
            onChangeText={(text) => updateWizardData('city', text)}
            placeholder="Ciudad"
          />
          {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}
        </View>
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Estado</Text>
        <TextInput
          style={styles.input}
          value={wizardData.state}
          onChangeText={(text) => updateWizardData('state', text)}
          placeholder="Estado"
        />
        {errors.state && <Text style={styles.errorText}>{errors.state}</Text>}
      </View>
    </View>
  );

  const renderStep7 = () => {
    const password = wizardData.password;
    const requirements = [
      { text: 'Al menos 8 caracteres', met: password.length >= 8 },
      { text: 'Una letra mayúscula', met: /[A-Z]/.test(password) },
      { text: 'Una letra minúscula', met: /[a-z]/.test(password) },
      { text: 'Un número', met: /[0-9]/.test(password) },
      { text: 'Un carácter especial', met: /[^A-Za-z0-9]/.test(password) },
    ];

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.stepTitle}>Contraseña</Text>
        <Text style={styles.stepSubtitle}>Crea una contraseña segura</Text>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Contraseña</Text>
          <TextInput
            style={styles.input}
            value={wizardData.password}
            onChangeText={(text) => updateWizardData('password', text)}
            placeholder="Tu contraseña"
            secureTextEntry
          />
          {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
        </View>

        {/* Password Requirements */}
        <View style={styles.requirementsContainer}>
          <Text style={styles.requirementsTitle}>Requisitos de la contraseña:</Text>
          {requirements.map((req, index) => (
            <View key={index} style={styles.requirementItem}>
              <Ionicons 
                name={req.met ? "checkmark-circle" : "ellipse-outline"} 
                size={16} 
                color={req.met ? "#34C759" : "#C7C7CC"} 
              />
              <Text style={[
                styles.requirementText,
                { color: req.met ? "#34C759" : "#666" }
              ]}>
                {req.text}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.passwordStrength}>
          <Text style={styles.strengthLabel}>Fortaleza de la contraseña:</Text>
          <View style={styles.strengthBar}>
            <View style={[
              styles.strengthFill,
              { 
                width: `${(passwordStrength / 5) * 100}%`,
                backgroundColor: passwordStrength < 2 ? '#FF3B30' : 
                                passwordStrength < 4 ? '#FF9500' : '#34C759'
              }
            ]} />
          </View>
          <Text style={[
            styles.strengthText,
            { 
              color: passwordStrength < 2 ? '#FF3B30' : 
                     passwordStrength < 4 ? '#FF9500' : '#34C759'
            }
          ]}>
            {passwordStrength < 2 ? 'Débil' : 
             passwordStrength < 4 ? 'Media' : 'Fuerte'}
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Confirmar contraseña</Text>
          <TextInput
            style={styles.input}
            value={wizardData.confirmPassword}
            onChangeText={(text) => updateWizardData('confirmPassword', text)}
            placeholder="Confirma tu contraseña"
            secureTextEntry
          />
          {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
        </View>
      </View>
    );
  };

  const renderStep8 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>PIN de seguridad</Text>
      <Text style={styles.stepSubtitle}>Crea un PIN de 4 dígitos para acceder a tu cuenta</Text>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>PIN</Text>
        <View style={styles.otpContainer}>
          {wizardData.pin.map((digit, index) => (
            <TextInput
              key={index}
              ref={el => { pinRefs.current[index] = el; }}
              style={styles.otpInput}
              value={digit}
              onChangeText={(text) => handlePINChange(index, text.replace(/\D/g, '').slice(0, 1), 'pin')}
              onKeyPress={({ nativeEvent }) => handlePINKeyPress(index, nativeEvent.key, 'pin')}
              placeholder="•"
              keyboardType="numeric"
              maxLength={1}
              textAlign="center"
            />
          ))}
        </View>
        {errors.pin && <Text style={styles.errorText}>{errors.pin}</Text>}
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.label}>Confirmar PIN</Text>
        <View style={styles.otpContainer}>
          {wizardData.confirmPin.map((digit, index) => (
            <TextInput
              key={index}
              ref={el => { confirmPinRefs.current[index] = el; }}
              style={styles.otpInput}
              value={digit}
              onChangeText={(text) => handlePINChange(index, text.replace(/\D/g, '').slice(0, 1), 'confirmPin')}
              onKeyPress={({ nativeEvent }) => handlePINKeyPress(index, nativeEvent.key, 'confirmPin')}
              placeholder="•"
              keyboardType="numeric"
              maxLength={1}
              textAlign="center"
            />
          ))}
        </View>
        {errors.confirmPin && <Text style={styles.errorText}>{errors.confirmPin}</Text>}
      </View>
    </View>
  );

  const renderStep9 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Verificación de identidad</Text>
      <Text style={styles.stepSubtitle}>Sube fotos de tu INE para verificar tu identidad (opcional)</Text>

      <View style={styles.uploadContainer}>
        <Text style={styles.uploadLabel}>INE Frente</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => handleFileUpload('front')}
        >
          {wizardData.ineFront ? (
            <View style={styles.uploadPreview}>
              <Ionicons name="checkmark-circle" size={24} color="#34C759" />
              <Text style={styles.uploadSuccessText}>Foto seleccionada</Text>
              <Text style={styles.uploadSubText}>Toca para cambiar</Text>
            </View>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Ionicons name="images-outline" size={32} color="#666" />
              <Text style={styles.uploadText}>Seleccionar de la galería</Text>
              <Text style={styles.uploadSubText}>JPG, PNG - Máx 10MB</Text>
            </View>
          )}
        </TouchableOpacity>
        {errors.ineFront && <Text style={styles.errorText}>{errors.ineFront}</Text>}
      </View>

      <View style={styles.uploadContainer}>
        <Text style={styles.uploadLabel}>INE Reverso</Text>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => handleFileUpload('back')}
        >
          {wizardData.ineBack ? (
            <View style={styles.uploadPreview}>
              <Ionicons name="checkmark-circle" size={24} color="#34C759" />
              <Text style={styles.uploadSuccessText}>Foto seleccionada</Text>
              <Text style={styles.uploadSubText}>Toca para cambiar</Text>
            </View>
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Ionicons name="images-outline" size={32} color="#666" />
              <Text style={styles.uploadText}>Seleccionar de la galería</Text>
              <Text style={styles.uploadSubText}>JPG, PNG - Máx 10MB</Text>
            </View>
          )}
        </TouchableOpacity>
        {errors.ineBack && <Text style={styles.errorText}>{errors.ineBack}</Text>}
      </View>

      <View style={{ marginTop: 24 }}>
        <Text style={styles.uploadLabel}>Código de referido (opcional)</Text>
        <TextInput
          style={[styles.input, { marginTop: 6, textTransform: 'uppercase', letterSpacing: 2 }]}
          placeholder="Ej. 081E51A8"
          placeholderTextColor="#999"
          value={wizardData.referralCode}
          onChangeText={text => updateWizardData('referralCode', text.toUpperCase().trim())}
          autoCapitalize="characters"
          maxLength={8}
        />
        <Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
          Si alguien te invitó, ingresa su código aquí
        </Text>
      </View>

      <View style={styles.skipContainer}>
        <Text style={styles.skipText}>
          Puedes completar la verificación de identidad más tarde desde tu perfil
        </Text>
      </View>
    </View>
  );

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      case 5: return renderStep5();
      case 6: return renderStep6();
      case 7: return renderStep7();
      case 8: return renderStep8();
      case 9: return renderStep9();
      default: return null;
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#3dbac6" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Crear cuenta</Text>
        <View style={styles.placeholder} />
      </View>

      {renderProgressBar()}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {renderCurrentStep()}
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navigation}>
        <TouchableOpacity
          style={[styles.navButton, styles.backNavButton]}
          onPress={handleBack}
        >
          <Text style={styles.backNavButtonText}>
            {currentStep === 1 ? 'Cancelar' : 'Atrás'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.navButton, styles.nextNavButton]}
          onPress={handleNext}
        >
          <Text style={styles.nextNavButtonText}>
            {currentStep === totalSteps ? 'Finalizar' : 'Continuar'}
          </Text>
        </TouchableOpacity>
      </View>
      
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
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#E5E5E5',
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3dbac6',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  stepContainer: {
    paddingVertical: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3dbac6',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 16,
    color: '#666',
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
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countryCode: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRightWidth: 0,
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  phoneInput: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    flex: 1,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginTop: 4,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  otpInput: {
    width: 60,
    height: 60,
    backgroundColor: 'white',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  resendButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    color: '#2A4DD0',
    fontSize: 16,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  radioOptionSelected: {
    backgroundColor: '#F0F4FF',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E5E5',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#3dbac6',
  },
  radioButtonInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3dbac6',
  },
  radioText: {
    fontSize: 16,
    color: '#333',
  },
  requirementsContainer: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  passwordStrength: {
    marginBottom: 20,
  },
  strengthLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  strengthBar: {
    height: 4,
    backgroundColor: '#E5E5E5',
    borderRadius: 2,
    marginBottom: 4,
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
  },
  uploadContainer: {
    marginBottom: 24,
  },
  uploadLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: '#E5E5E5',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
  },
  uploadPlaceholder: {
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 16,
    color: '#666',
    marginTop: 8,
  },
  uploadPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadSuccessText: {
    fontSize: 16,
    color: '#34C759',
    marginLeft: 8,
  },
  uploadSubText: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  skipContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  navigation: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  navButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  backNavButton: {
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  nextNavButton: {
    backgroundColor: '#3dbac6',
    marginLeft: 8,
  },
  backNavButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  nextNavButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
