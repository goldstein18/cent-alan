import { BadRequestException, Injectable } from '@nestjs/common';
import { BalanceService } from '../balance/balance.service';
import { SupabaseService } from '../supabase/supabase.service';
import { ExpenseCategoryDto, FinancialProjectionDto, FinancialRecommendationDto, FinanceSummaryDto, MonthlyAnalysisDto } from '../types/finance';

@Injectable()
export class FinanceService {
  constructor(
    private supabaseService: SupabaseService,
    private balanceService: BalanceService
  ) {}

  async getFinanceSummary(userId: string): Promise<FinanceSummaryDto> {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    const client = this.supabaseService.getClient();
    
    // Obtener balance
    const balance = await this.balanceService.getUserBalance(userId);
    
    // Calcular ingresos y gastos totales
    const { data: allTransactions } = await client
      .from('transactions')
      .select('type, amount, created_at')
      .eq('user_id', userId);

    const totalIncome = allTransactions
      ?.filter(t => t.type === 'deposit' || t.type === 'transfer_received' || t.type === 'investment_return')
      .reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

    const totalExpenses = allTransactions
      ?.filter(t => t.type === 'payment' || t.type === 'transfer_sent' || t.type === 'withdrawal')
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0) || 0;

    // Calcular ingresos y gastos del mes actual
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const monthlyTransactions = allTransactions?.filter(t => 
      t.created_at?.startsWith(currentMonth)
    ) || [];

    const monthlyIncome = monthlyTransactions
      .filter(t => t.type === 'deposit' || t.type === 'transfer_received' || t.type === 'investment_return')
      .reduce((sum, t) => sum + (t.amount || 0), 0);

    const monthlyExpenses = monthlyTransactions
      .filter(t => t.type === 'payment' || t.type === 'transfer_sent' || t.type === 'withdrawal')
      .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

    // Calcular tasa de ahorro
    const savingsRate = monthlyIncome > 0 ? (monthlyIncome - monthlyExpenses) / monthlyIncome : 0;

    // Contar inversiones activas
    const { data: investments } = await client
      .from('investments')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'active');

    // Contar metas activas
    const { data: goals } = await client
      .from('new_goals')
      .select('id')
      .eq('user_id', userId)
      .in('status', ['active', 'in_progress']);

    const lockedBalance = balance.total_balance - balance.available_balance;

    return {
      total_balance: balance.total_balance,
      available_balance: balance.available_balance,
      locked_balance: lockedBalance,
      total_income: totalIncome,
      total_expenses: totalExpenses,
      monthly_income: monthlyIncome,
      monthly_expenses: monthlyExpenses,
      savings_rate: Math.max(0, savingsRate),
      active_investments_count: investments?.length || 0,
      active_goals_count: goals?.length || 0
    };
  }

  async getExpenseCategories(userId: string, startDate?: string, endDate?: string): Promise<ExpenseCategoryDto[]> {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    const client = this.supabaseService.getClient();
    
    let query = client
      .from('transactions')
      .select('type, amount, description')
      .eq('user_id', userId)
      .in('type', ['payment', 'transfer_sent', 'withdrawal']);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const { data: transactions } = await query;

    // Agrupar por categoría
    const categoryMap = new Map<string, { amount: number; count: number }>();
    
    transactions?.forEach(t => {
      let category = 'Otros';
      
      if (t.type === 'payment') {
        category = 'Servicios';
      } else if (t.type === 'transfer_sent') {
        category = 'Transferencias';
      } else if (t.type === 'withdrawal') {
        category = 'Retiros';
      }

      const amount = Math.abs(t.amount || 0);
      const existing = categoryMap.get(category) || { amount: 0, count: 0 };
      categoryMap.set(category, {
        amount: existing.amount + amount,
        count: existing.count + 1
      });
    });

    const total = Array.from(categoryMap.values()).reduce((sum, cat) => sum + cat.amount, 0);

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      amount: data.amount,
      percentage: total > 0 ? (data.amount / total) * 100 : 0,
      transaction_count: data.count
    })).sort((a, b) => b.amount - a.amount);
  }

  async getMonthlyAnalysis(userId: string, months: number = 6): Promise<MonthlyAnalysisDto[]> {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    const client = this.supabaseService.getClient();
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    const { data: transactions } = await client
      .from('transactions')
      .select('type, amount, created_at')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    // Agrupar por mes
    const monthlyMap = new Map<string, { income: number; expenses: number; count: number }>();

    transactions?.forEach(t => {
      const month = t.created_at?.slice(0, 7);
      if (!month) return;

      const existing = monthlyMap.get(month) || { income: 0, expenses: 0, count: 0 };
      
      if (t.type === 'deposit' || t.type === 'transfer_received' || t.type === 'investment_return') {
        existing.income += t.amount || 0;
      } else if (t.type === 'payment' || t.type === 'transfer_sent' || t.type === 'withdrawal') {
        existing.expenses += Math.abs(t.amount || 0);
      }
      existing.count += 1;
      
      monthlyMap.set(month, existing);
    });

    return Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month,
        income: data.income,
        expenses: data.expenses,
        savings: data.income - data.expenses,
        transactions_count: data.count
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  async getFinancialProjections(userId: string, months: number = 6): Promise<FinancialProjectionDto[]> {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    const client = this.supabaseService.getClient();
    
    // Obtener datos históricos para calcular promedios
    const summary = await this.getFinanceSummary(userId);
    const monthlyAnalysis = await this.getMonthlyAnalysis(userId, 3);
    
    const avgIncome = monthlyAnalysis.length > 0
      ? monthlyAnalysis.reduce((sum, m) => sum + m.income, 0) / monthlyAnalysis.length
      : summary.monthly_income;
    
    const avgExpenses = monthlyAnalysis.length > 0
      ? monthlyAnalysis.reduce((sum, m) => sum + m.expenses, 0) / monthlyAnalysis.length
      : summary.monthly_expenses;

    const { data: balance } = await client
      .from('app_users')
      .select('total_balance')
      .eq('id', userId)
      .single();

    let currentBalance = balance?.total_balance || summary.total_balance;
    const projections: FinancialProjectionDto[] = [];

    for (let i = 1; i <= months; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() + i);
      
      currentBalance += avgIncome - avgExpenses;
      
      projections.push({
        month: date.toISOString().slice(0, 7),
        projected_balance: Math.max(0, currentBalance),
        projected_income: avgIncome,
        projected_expenses: avgExpenses
      });
    }

    return projections;
  }

  async getFinancialRecommendations(userId: string): Promise<FinancialRecommendationDto[]> {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    const summary = await this.getFinanceSummary(userId);
    const recommendations: FinancialRecommendationDto[] = [];

    // Recomendación de ahorro
    if (summary.savings_rate < 0.2) {
      recommendations.push({
        type: 'savings',
        title: 'Aumenta tu tasa de ahorro',
        description: `Tu tasa de ahorro actual es del ${(summary.savings_rate * 100).toFixed(1)}%. Intenta aumentarla al 20% para alcanzar tus metas más rápido.`,
        priority: 'high',
        action_url: '/goals'
      });
    }

    // Recomendación de inversión
    if (summary.available_balance > 5000 && summary.active_investments_count < 2) {
      recommendations.push({
        type: 'investment',
        title: 'Considera invertir más',
        description: `Tienes $${summary.available_balance.toLocaleString()} disponibles. Considera invertir una parte para generar rendimientos.`,
        priority: 'medium',
        action_url: '/investments'
      });
    }

    // Recomendación de metas
    if (summary.active_goals_count === 0) {
      recommendations.push({
        type: 'goal',
        title: 'Crea tu primera meta',
        description: 'Establece una meta financiera para mantenerte enfocado y alcanzar tus objetivos.',
        priority: 'high',
        action_url: '/goals'
      });
    }

    // Recomendación de gastos
    if (summary.monthly_expenses > summary.monthly_income * 0.8) {
      recommendations.push({
        type: 'expense',
        title: 'Revisa tus gastos',
        description: 'Tus gastos representan más del 80% de tus ingresos. Considera reducir gastos innecesarios.',
        priority: 'high',
        action_url: '/transactions'
      });
    }

    return recommendations;
  }
}


