export const translations = {
  'es-MX': {
    // Welcome Screen
    welcome: {
      title: 'Bienvenido a Cent',
      subtitle: 'Tu app financiera para ahorrar, invertir y proteger tu futuro',
      loginButton: 'Iniciar sesión',
      signupButton: 'Crear cuenta',
      termsText: 'Al continuar, aceptas nuestros',
      termsLink: 'Términos de Servicio',
      andText: 'y',
      privacyLink: 'Política de Privacidad',
    },

    // Signup Wizard
    signup: {
      headerTitle: 'Crear cuenta',
      progressText: 'Paso {current} de {total}',
      backButton: 'Atrás',
      continueButton: 'Continuar',
      finishButton: 'Finalizar',
      
      // Step 1: Phone & Email
      step1: {
        title: 'Teléfono y correo',
        subtitle: 'Necesitamos esta información para contactarte',
        phoneLabel: 'Teléfono',
        phonePlaceholder: '10 dígitos',
        emailLabel: 'Correo electrónico',
        emailPlaceholder: 'tu@email.com',
        phoneError: 'El teléfono debe tener 10 dígitos',
        emailError: 'Ingresa un correo electrónico válido',
      },

      // Step 2: OTP
      step2: {
        title: 'Verificación',
        subtitle: 'Ingresa el código de 4 dígitos enviado a tu teléfono',
        otpError: 'Ingresa el código de 4 dígitos',
        resendButton: 'Reenviar código',
        resendCooldown: 'Reenviar en {seconds}s',
        codeSent: 'Código enviado',
        codeSentMessage: 'Se ha enviado un nuevo código a tu teléfono.',
        incorrectCode: 'Código incorrecto. Intenta de nuevo.',
      },

      // Step 3: Personal Info
      step3: {
        title: 'Información personal',
        subtitle: 'Cuéntanos sobre ti',
        firstNameLabel: 'Nombre(s)',
        firstNamePlaceholder: 'Tu nombre',
        lastNameLabel: 'Primer apellido',
        lastNamePlaceholder: 'Tu primer apellido',
        secondLastNameLabel: 'Segundo apellido (opcional)',
        secondLastNamePlaceholder: 'Tu segundo apellido',
        firstNameError: 'El nombre es requerido',
        lastNameError: 'El primer apellido es requerido',
      },

      // Step 4: Birth Date
      step4: {
        title: 'Fecha de nacimiento',
        subtitle: 'Debes ser mayor de 18 años',
        birthDateLabel: 'Fecha de nacimiento',
        birthDatePlaceholder: 'DD/MM/AAAA',
        birthDateError: 'La fecha de nacimiento es requerida',
        ageError: 'Debes ser mayor de 18 años',
      },

      // Step 5: Gender
      step5: {
        title: 'Género',
        subtitle: 'Esta información es opcional',
        masculine: 'Masculino',
        feminine: 'Femenino',
        preferNotToSay: 'Prefiero no decir',
        other: 'Otro',
        otherGenderLabel: 'Especifica tu género',
        otherGenderPlaceholder: 'Especifica tu género',
        genderError: 'Selecciona tu género',
        otherGenderError: 'Especifica tu género',
      },

      // Step 6: Address
      step6: {
        title: 'Dirección',
        subtitle: 'Necesitamos tu dirección para verificación',
        streetLabel: 'Calle',
        streetPlaceholder: 'Nombre de la calle',
        exteriorNumberLabel: 'Número exterior',
        exteriorNumberPlaceholder: '123',
        interiorNumberLabel: 'Número interior (opcional)',
        interiorNumberPlaceholder: 'A',
        neighborhoodLabel: 'Colonia',
        neighborhoodPlaceholder: 'Nombre de la colonia',
        postalCodeLabel: 'Código postal',
        postalCodePlaceholder: '12345',
        cityLabel: 'Ciudad',
        cityPlaceholder: 'Ciudad',
        stateLabel: 'Estado',
        statePlaceholder: 'Estado',
        streetError: 'La calle es requerida',
        exteriorNumberError: 'El número exterior es requerido',
        neighborhoodError: 'La colonia es requerida',
        postalCodeError: 'El código postal debe tener 5 dígitos',
        cityError: 'La ciudad es requerida',
        stateError: 'El estado es requerido',
      },

      // Step 7: Password
      step7: {
        title: 'Contraseña',
        subtitle: 'Crea una contraseña segura',
        passwordLabel: 'Contraseña',
        passwordPlaceholder: 'Tu contraseña',
        confirmPasswordLabel: 'Confirmar contraseña',
        confirmPasswordPlaceholder: 'Confirma tu contraseña',
        strengthLabel: 'Fortaleza de la contraseña:',
        weak: 'Débil',
        medium: 'Media',
        strong: 'Fuerte',
        passwordError: 'La contraseña debe tener al menos 8 caracteres',
        passwordStrengthError: 'La contraseña debe ser más segura',
        confirmPasswordError: 'Las contraseñas no coinciden',
      },

      // Step 8: PIN
      step8: {
        title: 'PIN de seguridad',
        subtitle: 'Crea un PIN de 4 dígitos para acceder a tu cuenta',
        pinLabel: 'PIN',
        confirmPinLabel: 'Confirmar PIN',
        pinError: 'Ingresa un PIN de 4 dígitos',
        confirmPinError: 'Confirma tu PIN de 4 dígitos',
        pinMismatchError: 'Los PINs no coinciden',
      },

      // Step 9: KYC
      step9: {
        title: 'Verificación de identidad',
        subtitle: 'Sube fotos de tu INE para verificar tu identidad (opcional)',
        ineFrontLabel: 'INE Frente',
        ineBackLabel: 'INE Reverso',
        uploadText: 'Toca para subir foto',
        fileUploaded: 'Archivo subido',
        fileTooLarge: 'El archivo es demasiado grande. Máximo 10MB.',
        uploadError: 'No se pudo seleccionar el archivo.',
        ineFrontError: 'Sube la foto del frente de tu INE',
        ineBackError: 'Sube la foto del reverso de tu INE',
        skipText: 'Puedes completar la verificación de identidad más tarde desde tu perfil',
      },

      // Success
      success: {
        title: '¡Cuenta creada exitosamente!',
        message: 'Tu cuenta ha sido verificada y está lista para usar.',
        continueButton: 'Continuar',
      },
    },

    // Settings
    settings: {
      changePIN: 'Cambiar PIN',
      changePINTitle: 'Cambiar PIN de seguridad',
      currentPIN: 'PIN actual',
      newPIN: 'Nuevo PIN',
      confirmNewPIN: 'Confirmar nuevo PIN',
      pinUpdated: 'PIN actualizado correctamente',
      currentPINError: 'PIN actual incorrecto',
      newPINError: 'El nuevo PIN debe tener 4 dígitos',
      pinMismatchError: 'Los PINs no coinciden',
      save: 'Guardar',
    },

    // Common
    common: {
      error: 'Error',
      success: 'Éxito',
      cancel: 'Cancelar',
      confirm: 'Confirmar',
      loading: 'Cargando...',
      retry: 'Reintentar',
    },
  },
};

export type Language = keyof typeof translations;
export type TranslationKey = string;

export const getTranslation = (language: Language, key: TranslationKey, params?: Record<string, string | number>): string => {
  const keys = key.split('.');
  let value: any = translations[language];
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // Return key if translation not found
    }
  }

  if (typeof value === 'string') {
    if (params) {
      return value.replace(/\{(\w+)\}/g, (match, param) => {
        return params[param]?.toString() || match;
      });
    }
    return value;
  }

  return key;
};

// Default language
export const DEFAULT_LANGUAGE: Language = 'es-MX';
