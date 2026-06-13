interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export class ValidationService {
  // Phone validation for Mexican numbers
  static validatePhone(phone: string): string | null {
    if (!phone) {
      return 'El teléfono es requerido';
    }
    if (phone.length !== 10) {
      return 'El teléfono debe tener 10 dígitos';
    }
    if (!/^\d{10}$/.test(phone)) {
      return 'El teléfono solo debe contener números';
    }
    return null;
  }

  // Email validation
  static validateEmail(email: string): string | null {
    if (!email) {
      return 'El correo electrónico es requerido';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return 'Ingresa un correo electrónico válido';
    }
    return null;
  }

  // OTP validation
  static validateOTP(otp: string[]): string | null {
    const otpString = otp.join('');
    if (otpString.length !== 4) {
      return 'Ingresa el código de 4 dígitos';
    }
    if (!/^\d{4}$/.test(otpString)) {
      return 'El código solo debe contener números';
    }
    return null;
  }

  // Name validation
  static validateName(name: string, fieldName: string): string | null {
    if (!name || !name.trim()) {
      return `${fieldName} es requerido`;
    }
    if (name.trim().length < 2) {
      return `${fieldName} debe tener al menos 2 caracteres`;
    }
    if (name.trim().length > 50) {
      return `${fieldName} no puede tener más de 50 caracteres`;
    }
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(name.trim())) {
      return `${fieldName} solo debe contener letras y espacios`;
    }
    return null;
  }

  // Birth date validation
  static validateBirthDate(birthDate: string): string | null {
    if (!birthDate) {
      return 'La fecha de nacimiento es requerida';
    }

    // Check format DD/MM/YYYY
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = birthDate.match(dateRegex);
    
    if (!match) {
      return 'Formato de fecha inválido. Usa DD/MM/AAAA';
    }

    const [, day, month, year] = match;
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    
    // Check if date is valid
    if (date.getFullYear() !== parseInt(year) || 
        date.getMonth() !== parseInt(month) - 1 || 
        date.getDate() !== parseInt(day)) {
      return 'Fecha inválida';
    }

    // Check if date is not in the future
    const today = new Date();
    if (date > today) {
      return 'La fecha de nacimiento no puede ser en el futuro';
    }

    // Check if user is at least 18 years old
    const age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();
    const dayDiff = today.getDate() - date.getDate();
    
    if (age < 18 || (age === 18 && (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)))) {
      return 'Debes ser mayor de 18 años';
    }

    return null;
  }

  // Gender validation
  static validateGender(gender: string, otherGender?: string): string | null {
    if (!gender) {
      return 'Selecciona tu género';
    }
    if (gender === 'Otro' && (!otherGender || !otherGender.trim())) {
      return 'Especifica tu género';
    }
    return null;
  }

  // Address validation
  static validateAddress(data: {
    street: string;
    exteriorNumber: string;
    neighborhood: string;
    postalCode: string;
    city: string;
    state: string;
  }): Record<string, string> {
    const errors: Record<string, string> = {};

    if (!data.street || !data.street.trim()) {
      errors.street = 'La calle es requerida';
    }

    if (!data.exteriorNumber || !data.exteriorNumber.trim()) {
      errors.exteriorNumber = 'El número exterior es requerido';
    }

    if (!data.neighborhood || !data.neighborhood.trim()) {
      errors.neighborhood = 'La colonia es requerida';
    }

    if (!data.postalCode || data.postalCode.length !== 5) {
      errors.postalCode = 'El código postal debe tener 5 dígitos';
    } else if (!/^\d{5}$/.test(data.postalCode)) {
      errors.postalCode = 'El código postal solo debe contener números';
    }

    if (!data.city || !data.city.trim()) {
      errors.city = 'La ciudad es requerida';
    }

    if (!data.state || !data.state.trim()) {
      errors.state = 'El estado es requerido';
    }

    return errors;
  }

  // Password validation
  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Al menos 8 caracteres');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Al menos una mayúscula');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Al menos una minúscula');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Al menos un número');
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Al menos un carácter especial');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // Password confirmation validation
  static validatePasswordConfirmation(password: string, confirmPassword: string): string | null {
    if (!confirmPassword) {
      return 'Confirma tu contraseña';
    }
    if (password !== confirmPassword) {
      return 'Las contraseñas no coinciden';
    }
    return null;
  }

  // File upload validation
  static validateFileUpload(file: any, maxSizeMB: number = 10): string | null {
    if (!file) {
      return 'Selecciona un archivo';
    }

    if (file.size && file.size > maxSizeMB * 1024 * 1024) {
      return `El archivo es demasiado grande. Máximo ${maxSizeMB}MB.`;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (file.mimeType && !allowedTypes.includes(file.mimeType)) {
      return 'Solo se permiten archivos JPG y PNG';
    }

    return null;
  }

  // Step validation
  static validateStep(step: number, data: any): ValidationResult {
    const errors: Record<string, string> = {};

    switch (step) {
      case 1:
        const phoneError = this.validatePhone(data.phone);
        const emailError = this.validateEmail(data.email);
        if (phoneError) errors.phone = phoneError;
        if (emailError) errors.email = emailError;
        break;

      case 2:
        const otpError = this.validateOTP(data.otp);
        if (otpError) errors.otp = otpError;
        break;

      case 3:
        const firstNameError = this.validateName(data.firstName, 'El nombre');
        const lastNameError = this.validateName(data.lastName, 'El primer apellido');
        if (firstNameError) errors.firstName = firstNameError;
        if (lastNameError) errors.lastName = lastNameError;
        break;

      case 4:
        const birthDateError = this.validateBirthDate(data.birthDate);
        if (birthDateError) errors.birthDate = birthDateError;
        break;

      case 5:
        const genderError = this.validateGender(data.gender, data.otherGender);
        if (genderError) errors.gender = genderError;
        break;

      case 6:
        const addressErrors = this.validateAddress(data);
        Object.assign(errors, addressErrors);
        break;

      case 7:
        const passwordValidation = this.validatePassword(data.password);
        if (!passwordValidation.isValid) {
          errors.password = `La contraseña debe tener: ${passwordValidation.errors.join(', ')}`;
        }
        const confirmPasswordError = this.validatePasswordConfirmation(data.password, data.confirmPassword);
        if (confirmPasswordError) errors.confirmPassword = confirmPasswordError;
        break;

      case 8:
        // PIN validation
        if (!data.pin || data.pin.join('').length !== 4) {
          errors.pin = 'Ingresa un PIN de 4 dígitos';
        }
        if (!data.confirmPin || data.confirmPin.join('').length !== 4) {
          errors.confirmPin = 'Confirma tu PIN de 4 dígitos';
        }
        if (data.pin && data.confirmPin && data.pin.join('') !== data.confirmPin.join('')) {
          errors.confirmPin = 'Los PINs no coinciden';
        }
        break;

      case 9:
        // INE uploads are now optional, so only validate if files are provided
        if (data.ineFront) {
          const ineFrontError = this.validateFileUpload(data.ineFront);
          if (ineFrontError) errors.ineFront = ineFrontError;
        }
        if (data.ineBack) {
          const ineBackError = this.validateFileUpload(data.ineBack);
          if (ineBackError) errors.ineBack = ineBackError;
        }
        break;
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    };
  }

  // Format phone number for display
  static formatPhoneNumber(phone: string): string {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `+52 ${cleaned.slice(0, 2)} ${cleaned.slice(2, 6)} ${cleaned.slice(6)}`;
    }
    return `+52 ${cleaned}`;
  }

  // Format date for display
  static formatDate(date: string): string {
    if (!date) return '';
    const cleaned = date.replace(/\D/g, '');
    if (cleaned.length >= 8) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4, 8)}`;
    }
    return cleaned.replace(/(\d{2})(\d{2})(\d{4})/, '$1/$2/$3');
  }

  // Calculate password strength
  static calculatePasswordStrength(password: string): number {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  }

  // Get password strength label
  static getPasswordStrengthLabel(strength: number): string {
    if (strength < 2) return 'Débil';
    if (strength < 4) return 'Media';
    return 'Fuerte';
  }

  // Get password strength color
  static getPasswordStrengthColor(strength: number): string {
    if (strength < 2) return '#FF3B30';
    if (strength < 4) return '#FF9500';
    return '#34C759';
  }
}
