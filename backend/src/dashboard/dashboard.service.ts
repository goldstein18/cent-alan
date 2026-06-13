import { BadRequestException, Injectable } from '@nestjs/common';
import { BalanceService } from '../balance/balance.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DashboardService {
  constructor(
    private supabaseService: SupabaseService,
    private balanceService: BalanceService
  ) {}

  async getDashboardData(userId: string) {
    if (!this.supabaseService.getClient()) {
      throw new BadRequestException('Supabase no configurado');
    }

    // Obtener balance
    const balance = await this.balanceService.getUserBalance(userId);

    // Obtener transacciones recientes
    const { data: transactions } = await this.supabaseService.getClient()
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5);

    // Obtener inversiones activas
    const { data: investments } = await this.supabaseService.getClient()
      .from('investments')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    // Obtener metas activas
    const { data: goals } = await this.supabaseService.getClient()
      .from('new_goals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    return {
      available_balance: balance.available_balance,
      total_balance: balance.total_balance,
      recent_transactions: transactions || [],
      active_investments: investments || [],
      active_goals: goals || []
    };
  }
}
