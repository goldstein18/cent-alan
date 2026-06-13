export interface CreateBeneficiaryDto {
  name: string;
  phone: string;
  email?: string;
  relationship?: string;
  isPrimary?: boolean;
}

export interface BeneficiaryModel {
  id: string;
  userId: string;
  name: string;
  phone: string;
  email?: string;
  relationship: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

