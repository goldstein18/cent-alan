export type TransactionType = 'deposit' | 'internal_transfer' | 'external_transfer' | 'payment' | 'investment' | 'withdrawal';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface Transaction {
  _id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  description: string;
  reference: string;
  status: TransactionStatus;
  fromAccount?: string;
  toAccount?: string;
  bankName?: string;
  clabe?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTransactionDto {
  type: TransactionType;
  amount: number;
  description: string;
  toAccount?: string;
  bankName?: string;
  clabe?: string;
  pin: string;
  metadata?: Record<string, any>;
}

export interface TransferInternalDto {
  toPhoneNumber: string;
  amount: number;
  description: string;
  pin: string;
}

export interface TransferExternalDto {
  beneficiaryName: string;
  bankName: string;
  clabe: string;
  amount: number;
  description: string;
  pin: string;
}

export interface DepositDto {
  amount: number;
  description: string;
  reference: string;
}

export interface PaymentDto {
  amount: number;
  description: string;
  reference: string;
  pin: string;
}

export interface TransactionFilters {
  type?: TransactionType;
  status?: TransactionStatus;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
}
