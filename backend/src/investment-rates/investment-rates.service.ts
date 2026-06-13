import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateInvestmentRateDto, InvestmentRate } from '../types/investment-rate';

const RATES_TABLE = 'investment_rates';
const RATES_HISTORY_TABLE = 'investment_rates_history';

@Injectable()
export class InvestmentRatesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getRates(): Promise<InvestmentRate[]> {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new BadRequestException('Supabase no configurado');
    }

    // Get all rates, ordered by updated_at DESC to ensure newest first
    // Since type is PRIMARY KEY, each type has only one record (the latest)
    const { data, error } = await client
      .from(RATES_TABLE)
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Error al obtener tasas: ${error.message}`);
    }

    return (data || []).map(row => {
      // Normalize rate: if < 1, convert to percentage; if >= 1, it's already a percentage
      const rate = Number(row.interest_rate ?? 0);
      const normalizedRate = rate < 1 ? rate * 100 : rate;
      
      return {
        type: row.type,
        interestRate: normalizedRate,
        updatedAt: row.updated_at,
      };
    });
  }

  async upsertRate(dto: CreateInvestmentRateDto, adminId?: string, notes?: string): Promise<InvestmentRate> {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new BadRequestException('Supabase no configurado');
    }

    // Normalize interest rate: always save as percentage (10.5 = 10.5%, 5.0 = 5%)
    // If value is < 1, assume it's a decimal and convert to percentage (0.105 = 10.5%)
    // If value is >= 1, assume it's already a percentage (10.5 = 10.5%)
    let percentageRate: number;
    if (dto.interestRate < 1) {
      // Convert decimal to percentage (0.105 -> 10.5)
      percentageRate = dto.interestRate * 100;
    } else {
      // Already a percentage (10.5 -> 10.5)
      percentageRate = dto.interestRate;
    }

    // Validate rate is between 0% and 100%
    if (percentageRate < 0 || percentageRate > 100) {
      throw new BadRequestException('La tasa de interés debe estar entre 0% y 100%');
    }

    // Get current rate before updating (to save in history)
    const { data: currentData } = await client
      .from(RATES_TABLE)
      .select('interest_rate')
      .eq('type', dto.type)
      .single();

    // Normalize previous rate if it exists (could be decimal or percentage)
    let previousRate: number | null = null;
    if (currentData?.interest_rate) {
      const prev = Number(currentData.interest_rate);
      previousRate = prev < 1 ? prev * 100 : prev; // Convert to percentage if decimal
    }

    // Update or insert the rate (always save as percentage: 10.5, 5.0, etc.)
    const { data, error } = await client
      .from(RATES_TABLE)
      .upsert({
        type: dto.type,
        interest_rate: percentageRate,
        changed_by: adminId || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'type'
      })
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(`Error al guardar la tasa: ${error.message}`);
    }

    // Save to history table (also as percentage)
    const { error: historyError } = await client
      .from(RATES_HISTORY_TABLE)
      .insert({
        type: dto.type,
        interest_rate: percentageRate,
        previous_rate: previousRate,
        changed_by: adminId || null,
        notes: notes || null,
      });

    if (historyError) {
      // Log error but don't fail the operation
      console.error('Error al guardar historial de tasa:', historyError);
    }

    // Return rate as percentage (already normalized above)
    const returnedRate = Number(data.interest_rate ?? 0);
    const normalizedReturnRate = returnedRate < 1 ? returnedRate * 100 : returnedRate;
    
    return {
      type: data.type,
      interestRate: normalizedReturnRate,
      updatedAt: data.updated_at,
    };
  }
}

