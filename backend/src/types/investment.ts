export type InvestmentTerm = 3 | 6 | 9 | 12; // months
export type Periodicity = 'diaria' | 'semanal' | 'quincenal' | 'mensual';
export type InvestmentStatus = 'active' | 'matured' | 'cancelled';

export interface InvestmentRecord {
  id: string;
  userId: string;
  amount: number;
  term: number;
  interestRate: number;
  createdAt: string;
  maturityDate: string;
  isDomiciliation: boolean;
  oldSystem: boolean;
  periodicity?: Periodicity | null;
  periodicityDays?: number | null;
  nextChargeDate?: string | null;
  isPaused?: boolean | null;
  isCancelled?: boolean | null;
  chargeDay?: number | null;
  status: InvestmentStatus;
  updatedAt?: string | null;
}

export interface CreateInvestmentDto {
  amount: number;
  term: InvestmentTerm;
  pin: string;
}

export interface CreateDomiciliationDto {
  amount: number;
  periodicity: Periodicity;
  chargeDay: number;
  startDate?: string; // Fecha de inicio en formato YYYY-MM-DD
  term?: number; // Plazo en meses: 3, 6, 9, 12
  pin: string;
}

export interface InvestmentCalculation {
  principal: number;
  interestRate: number;
  term: number;
  totalEarnings: number;
  maturityAmount: number;
  dailyEarnings: number;
  monthlyEarnings: number;
}

export interface DomiciliationManagementDto {
  action: 'pause' | 'resume' | 'cancel' | 'update_schedule';
  chargeDay?: number;
  periodicityDays?: number;
  periodicity?: string;
  startDate?: string;
  amount?: number;
}

export interface InvestmentFilters {
  status?: 'active' | 'matured' | 'cancelled';
  isDomiciliation?: boolean;
  startDate?: string;
  endDate?: string;
}
