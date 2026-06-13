import { Address, KycDocuments, ReferralInfo } from './common';

export interface User {
  _id: string;
  phoneNumber: string;
  email: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  address: Address;
  kycDocuments?: KycDocuments;
  pin: string; // Hashed
  referralInfo: ReferralInfo;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserDto {
  phoneNumber: string;
  email: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  address: Address;
  pin: string;
  referredBy?: string;
}

export interface UpdateUserDto {
  email?: string;
  firstName?: string;
  lastName?: string;
  address?: Partial<Address>;
}

export interface ChangePinDto {
  currentPin?: string; // Opcional: si no se envía o viene vacío, se permite cambiar sin verificación
  newPin: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;
}

export interface UserProfile {
  _id: string;
  phoneNumber: string;
  email: string;
  firstName: string;
  lastName: string;
  referralCode: string;
  isActive: boolean;
  createdAt: Date;
}
