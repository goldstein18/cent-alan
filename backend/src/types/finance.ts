export interface FinanceSummaryDto {
  total_balance: number;
  available_balance: number;
  locked_balance: number;
  total_income: number;
  total_expenses: number;
  monthly_income: number;
  monthly_expenses: number;
  savings_rate: number;
  active_investments_count: number;
  active_goals_count: number;
}

export interface ExpenseCategoryDto {
  category: string;
  amount: number;
  percentage: number;
  transaction_count: number;
}

export interface MonthlyAnalysisDto {
  month: string;
  income: number;
  expenses: number;
  savings: number;
  transactions_count: number;
}

export interface FinancialProjectionDto {
  month: string;
  projected_balance: number;
  projected_income: number;
  projected_expenses: number;
}

export interface FinancialRecommendationDto {
  type: 'savings' | 'investment' | 'goal' | 'expense';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  action_url?: string;
}


