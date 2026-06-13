export interface Goal {
  _id: string;
  userId: string;
  name: string;
  targetAmount: number;
  progress: number;
  deadline: Date;
  hasRendimientos: boolean;
  rendimientosGenerados: number;
  nextAbonoDate?: Date;
  isCompleted: boolean;
  isExpired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateGoalDto {
  name: string;
  category?: string;
  description?: string;
  targetAmount: number;
  deadline: string;
  frequency?: string;
  paymentType?: string;
  type?: 'sin-rendimiento' | 'con-rendimiento';
  hasRendimientos?: boolean;
}

export interface FundGoalDto {
  goalId: string;
  amount: number;
  pin: string;
}

export interface WithdrawFromGoalDto {
  goalId: string;
  amount: number;
  pin: string;
}

export interface CancelGoalDto {
  pin: string;
}

export interface GoalFilters {
  isCompleted?: boolean;
  isExpired?: boolean;
  hasRendimientos?: boolean;
  startDate?: string;
  endDate?: string;
}

export interface GoalProgress {
  goalId: string;
  name: string;
  progress: number;
  targetAmount: number;
  percentage: number;
  remainingAmount: number;
  daysRemaining: number;
  isCompleted: boolean;
  isExpired: boolean;
}
