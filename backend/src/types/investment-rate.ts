export interface InvestmentRate {
  type: 'normal' | 'pro';
  interestRate: number;
  updatedAt: string;
}

export interface CreateInvestmentRateDto {
  type: 'normal' | 'pro';
  interestRate: number;
}

