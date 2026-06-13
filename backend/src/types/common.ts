export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Address {
  street: string;
  exteriorNumber: string;
  interiorNumber?: string;
  neighborhood: string;
  postalCode: string;
  city: string;
  state: string;
}

export interface KycDocuments {
  frontUrl: string;
  backUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedAt: Date;
}

export interface ReferralInfo {
  code: string;
  referredBy?: string;
  commissionEarned: number;
  totalReferrals: number;
}
