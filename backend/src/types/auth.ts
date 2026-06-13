export interface LoginDto {
  phoneNumber: string;
  otp: string;
}

export interface LoginWithPasswordDto {
  phoneNumber: string;
  password: string;
}

export interface SendOtpDto {
  phoneNumber: string;
  email?: string;
}

export interface ResetPasswordDto {
  phoneNumber: string;
  otp: string;
  newPassword: string;
}

export interface VerifyOtpDto {
  phoneNumber: string;
  otp: string;
}

export interface OtpResponse {
  success: boolean;
  message: string;
  expiresIn?: number;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    phoneNumber: string;
    firstName: string;
    lastName: string;
  };
}

export interface JwtPayload {
  sub: string;
  phoneNumber: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface SignupDto {
  phoneNumber: string;
  email: string;
  firstName: string;
  lastName: string;
  secondLastName?: string;
  birthDate: string;
  gender: string;
  street: string;
  exteriorNumber: string;
  interiorNumber?: string;
  neighborhood: string;
  postalCode: string;
  city: string;
  state: string;
  password: string;
  otp: string; // OTP verificado previamente
  referredBy?: string;
}
