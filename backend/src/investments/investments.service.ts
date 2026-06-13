import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { BalanceService } from '../balance/balance.service';
import { InvestmentRatesService } from '../investment-rates/investment-rates.service';
import { NotificationsService } from '../notifications/notifications.service';
import { isActiveTermInvestment } from './investment-classification';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateDomiciliationDto, CreateInvestmentDto, DomiciliationManagementDto, InvestmentCalculation, InvestmentRecord } from '../types/investment';

@Injectable()
export class InvestmentsService {
  constructor(
    private supabaseService: SupabaseService,
    private balanceService: BalanceService,
    private investmentRatesService: InvestmentRatesService,
    private notificationsService: NotificationsService,
  ) {}

  /**
   * Get the current investment rate (percentage). Falls back to 7.4% if none available.
   * If a preferred type is provided (e.g., 'pro'), try that first.
   */
  private async getRatePercentage(preferredType?: string): Promise<number> {
    try {
      const rates = await this.investmentRatesService.getRates();
      // Try preferred type first
      const preferred = preferredType
        ? rates.find(r => r.type?.toLowerCase() === preferredType.toLowerCase())
        : undefined;
      // Otherwise prefer pro, otherwise latest
      const proRate = rates.find(r => r.type?.toLowerCase() === 'pro');
      const selected = preferred ?? proRate ?? rates[0];
      if (selected?.interestRate !== undefined) {
        return Number(selected.interestRate);
      }
    } catch (error) {
      console.error('[Investments] Error fetching rates, fallback to 7.4%:', error);
    }
    return 7.4;
  }

  private async verifyPin(userId: string, pin: string): Promise<boolean> {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new BadRequestException('Supabase no configurado');
    }

    const { data: user, error } = await client
      .from('app_users')
      .select('pin, password_salt')
      .eq('id', userId)
      .single();

    if (error || !user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Verificar PIN usando SHA1 con salt (mismo algoritmo que login)
    const pinWithSalt = pin + (user.password_salt || '');
    const hashedPin = crypto.createHash('sha1').update(pinWithSalt).digest('hex');

    return hashedPin.toLowerCase() === user.pin.toLowerCase();
  }

  async getInvestments(userId: string): Promise<InvestmentRecord[]> {
    return this.supabaseService.getInvestments(userId);
  }

  async createInvestment(userId: string, createInvestmentDto: CreateInvestmentDto) {
    try {
      // Verificar PIN
      const isValidPin = await this.verifyPin(userId, createInvestmentDto.pin);
      if (!isValidPin) {
        throw new UnauthorizedException('PIN incorrecto');
      }

      // Verificar balance disponible usando cálculo dinámico
      const availableBalance = await this.balanceService.getAvailableBalance(userId);
      const roundedAvailable = Math.round(availableBalance.availableBalance * 100) / 100;
      const roundedRequested = Math.round(createInvestmentDto.amount * 100) / 100;
      if (roundedAvailable < roundedRequested) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponible: $${availableBalance.availableBalance.toFixed(2)}, Solicitado: $${createInvestmentDto.amount.toFixed(2)}`
        );
      }

    // LÓGICA: Solo las inversiones PRO tienen límite de 10,000
    // Las inversiones normales NO tienen límite
    const existingInvestments = await this.supabaseService.getInvestments(userId);
    const proActiveTotal = existingInvestments
      .filter(inv => !inv.oldSystem && isActiveTermInvestment(inv))
      .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
    const proAllowance = Math.max(0, 10000 - proActiveTotal);

    // Decide whether this investment is PRO or standard
    // SOLO puede ser PRO si hay espacio disponible (menos de 10,000 en inversiones PRO activas)
    // Si ya tiene $10,000 o más invertidos en PRO, debe ser normal (sin límite)
    const isProInvestment = proAllowance > 0 && createInvestmentDto.amount <= proAllowance;
    const selectedRateType = isProInvestment ? 'pro' : 'normal';

      const maturityDate = new Date();
      maturityDate.setMonth(maturityDate.getMonth() + createInvestmentDto.term);

      const ratePercent = await this.getRatePercentage(selectedRateType);

      const reference = `INV-${Date.now()}`;

      // Deduct balance BEFORE creating the investment in DB.
      // If we insert first, deductBalance re-queries activeInvestmentsPrincipal and
      // sees the new investment already included, making available appear as $0 and
      // rejecting a valid deduction ("Saldo insuficiente").
      try {
        await this.balanceService.deductBalance(
          userId,
          createInvestmentDto.amount,
          reference,
          `Inversión a ${createInvestmentDto.term} meses`
        );
      } catch (error) {
        console.error('Error deducting balance:', error);
        throw new BadRequestException(`Error al deducir el balance: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }

      const investmentData = {
        user_id: userId,
        amount: createInvestmentDto.amount,
        term: createInvestmentDto.term,
        // store as decimal (e.g., 7.4% => 0.074)
        interest_rate: ratePercent / 100,
        maturity_date: maturityDate.toISOString(),
        is_domiciliation: false,
        // Mark as non-PRO when over the cap so UI can distinguish (old_system true => normal)
        old_system: !isProInvestment,
        status: 'active',
      };

      let investment;
      try {
        investment = await this.supabaseService.createInvestment(investmentData);
      } catch (error) {
        console.error('Error creating investment in database:', error);
        // Refund the balance since the investment was not created
        try {
          await this.balanceService.addBalance(
            userId,
            createInvestmentDto.amount,
            `${reference}-REV`,
            'Reversa por error al crear inversión'
          );
        } catch (refundError) {
          console.error('CRITICAL: Could not refund balance after investment creation failure:', refundError);
        }
        throw new BadRequestException(`Error al crear la inversión en la base de datos: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      }

      // Crear transacción
      try {
        await this.supabaseService.createTransaction({
          user_id: userId,
          type: 'investment',
          amount: createInvestmentDto.amount,
          description: `Inversión a ${createInvestmentDto.term} meses`,
          reference,
          status: 'completed',
        });
      } catch (error) {
        console.error('Error creating transaction:', error);
        // No lanzar error aquí, la inversión y la deducción ya se hicieron
        // Solo loggear el error
      }

      return investment;
    } catch (error) {
      // Re-lanzar excepciones conocidas de NestJS
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      // Para otros errores, loggear y lanzar un error genérico con más información
      console.error('Error in createInvestment:', {
        userId,
        amount: createInvestmentDto.amount,
        term: createInvestmentDto.term,
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new BadRequestException(`Error al crear la inversión: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  async createDomiciliation(userId: string, createDomiciliationDto: CreateDomiciliationDto) {
    // Verificar PIN
    const isValidPin = await this.verifyPin(userId, createDomiciliationDto.pin);
    if (!isValidPin) {
      throw new UnauthorizedException('PIN incorrecto');
    }

    // Verificar balance disponible para el primer cargo usando cálculo dinámico
    const availableBalance = await this.balanceService.getAvailableBalance(userId);
    if (availableBalance.availableBalance < createDomiciliationDto.amount) {
      throw new BadRequestException(
        `Saldo insuficiente para el primer cargo. Disponible: $${availableBalance.availableBalance.toFixed(2)}, Solicitado: $${createDomiciliationDto.amount.toFixed(2)}`
      );
    }

    // Usar fecha de inicio proporcionada o calcular basado en chargeDay
    let nextChargeDate: Date;
    let chargeDayToUse = createDomiciliationDto.chargeDay;
    
    if (createDomiciliationDto.startDate) {
      nextChargeDate = new Date(createDomiciliationDto.startDate);
      // Asegurar que la fecha de inicio no sea anterior a hoy
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (nextChargeDate < today) {
        throw new BadRequestException('La fecha de inicio no puede ser anterior a hoy.');
      }
      // Si se proporciona startDate, usar el día de esa fecha para chargeDay si no se especificó
      if (!chargeDayToUse) {
        chargeDayToUse = nextChargeDate.getDate();
      }
    } else {
      // Si no se proporciona startDate, usar el día de cargo del mes actual o siguiente
      nextChargeDate = new Date();
      if (!chargeDayToUse) {
        chargeDayToUse = nextChargeDate.getDate();
      }
      nextChargeDate.setDate(chargeDayToUse);
      if (nextChargeDate < new Date()) {
        nextChargeDate.setMonth(nextChargeDate.getMonth() + 1);
      }
    }

    // Usar plazo proporcionado o 12 meses por defecto
    const term = createDomiciliationDto.term || 12;
    if (![3, 6, 9, 12].includes(term)) {
      throw new BadRequestException('El plazo debe ser 3, 6, 9 o 12 meses.');
    }

    // Domiciliations follow the current PRO rate selection logic; no cap applied here
    const ratePercent = await this.getRatePercentage('pro');

    // Calcular fecha de vencimiento basada en el plazo
    const maturityDate = new Date(nextChargeDate);
    maturityDate.setMonth(maturityDate.getMonth() + term);

    const investmentData = {
      user_id: userId,
      amount: createDomiciliationDto.amount,
      term: term,
      interest_rate: ratePercent / 100, // store as decimal
      maturity_date: maturityDate.toISOString(),
      is_domiciliation: true,
      periodicity: createDomiciliationDto.periodicity,
      periodicity_days: this.getPeriodicityDays(createDomiciliationDto.periodicity),
      next_charge_date: nextChargeDate.toISOString(),
      charge_day: chargeDayToUse,
      old_system: false,
      status: 'active',
    };

    // Deduct balance BEFORE inserting domiciliation (same reason as createInvestment:
    // avoid double-counting the new investment in the available balance validation).
    const reference = `DOM-${Date.now()}`;
    try {
      await this.balanceService.deductBalance(
        userId,
        createDomiciliationDto.amount,
        reference,
        `Domiciliación automática - ${createDomiciliationDto.periodicity}`
      );
    } catch (error) {
      throw new BadRequestException(`Error al deducir el balance: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }

    let investment;
    try {
      investment = await this.supabaseService.createInvestment(investmentData);
    } catch (error) {
      // Refund the balance since the investment was not created
      try {
        await this.balanceService.addBalance(
          userId,
          createDomiciliationDto.amount,
          `${reference}-REV`,
          'Reversa por error al crear domiciliación'
        );
      } catch (refundError) {
        console.error('CRITICAL: Could not refund balance after domiciliation creation failure:', refundError);
      }
      throw new BadRequestException(`Error al crear la domiciliación: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }

    // Crear transacción
    await this.supabaseService.createTransaction({
      user_id: userId,
      type: 'investment',
      amount: createDomiciliationDto.amount,
      description: `Domiciliación automática - ${createDomiciliationDto.periodicity}`,
      reference,
      status: 'completed',
    });

    return investment;
  }

  async manageDomiciliation(
    userId: string,
    investmentId: string,
    managementDto: DomiciliationManagementDto
  ): Promise<InvestmentRecord | null> {
    const updates: Record<string, any> = {};
    
    switch (managementDto.action) {
      case 'pause':
        updates.is_paused = true;
        updates.status = 'active';
        break;
      case 'resume':
        updates.is_paused = false;
        break;
      case 'cancel':
        updates.is_cancelled = true;
        updates.status = 'cancelled';
        updates.is_paused = false;
        break;
      case 'update_schedule':
        // Si se proporciona amount, actualizar el monto
        if (typeof managementDto.amount === 'number' && managementDto.amount > 0) {
          updates.amount = managementDto.amount;
        }
        
        // Si se proporciona periodicity, actualizar periodicity y periodicity_days
        if (managementDto.periodicity) {
          updates.periodicity = managementDto.periodicity;
          updates.periodicity_days = this.getPeriodicityDays(managementDto.periodicity);
        }
        
        // Si se proporciona startDate, calcular next_charge_date basado en la nueva fecha
        if (managementDto.startDate) {
          const startDate = new Date(managementDto.startDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          
          // Si la fecha de inicio es hoy o en el futuro, usarla como próxima fecha de cargo
          if (startDate >= today) {
            updates.next_charge_date = startDate.toISOString();
            // Si no se especificó chargeDay, usar el día de la fecha de inicio
            if (typeof managementDto.chargeDay !== 'number') {
              updates.charge_day = startDate.getDate();
            }
          } else {
            // Si la fecha es en el pasado, calcular la próxima fecha basada en la periodicidad
            const periodicityDays = managementDto.periodicity 
              ? this.getPeriodicityDays(managementDto.periodicity)
              : (updates.periodicity_days || 15);
            
            const nextChargeDate = this.calculateNextChargeDate(
              startDate.getDate(),
              periodicityDays
            );
            
            if (nextChargeDate) {
              updates.next_charge_date = nextChargeDate.toISOString();
            }
          }
        }
        
        // Mantener compatibilidad con los campos antiguos
        if (typeof managementDto.chargeDay === 'number') {
          updates.charge_day = managementDto.chargeDay;
        }
        if (typeof managementDto.periodicityDays === 'number') {
          updates.periodicity_days = managementDto.periodicityDays;
        }

        // Si no se proporcionó startDate pero sí chargeDay y periodicityDays, calcular next_charge_date
        if (!managementDto.startDate && (managementDto.chargeDay || managementDto.periodicityDays)) {
          const nextChargeDate = this.calculateNextChargeDate(
            managementDto.chargeDay,
            managementDto.periodicityDays
          );

          if (nextChargeDate) {
            updates.next_charge_date = nextChargeDate.toISOString();
          }
        }
        break;
    }

    if (Object.keys(updates).length === 0) {
      const investment = await this.supabaseService.getInvestmentById(userId, investmentId);
      return investment;
    }

    return this.supabaseService.updateInvestment(investmentId, userId, updates);
  }

  async calculateInvestment(amount: number, term: number): Promise<InvestmentCalculation> {
    const ratePercent = await this.getRatePercentage('pro');
    const interestRate = ratePercent / 100;
    // Interés compuesto mensual: principal × ((1 + tasa/12)^meses - 1)
    const totalEarnings = amount * (Math.pow(1 + interestRate / 12, term) - 1);
    const maturityAmount = amount + totalEarnings;
    const dailyEarnings = totalEarnings / (term * 30);
    const monthlyEarnings = totalEarnings / term;

    return {
      principal: amount,
      interestRate: ratePercent, // return as percentage
      term,
      totalEarnings,
      maturityAmount,
      dailyEarnings,
      monthlyEarnings,
    };
  }

  private getPeriodicityDays(periodicity: string): number {
    switch (periodicity) {
      case 'diaria': return 1;
      case 'semanal': return 7;
      case 'quincenal': return 15;
      case 'mensual': return 30;
      default: return 30;
    }
  }

  private calculateNextChargeDate(
    chargeDay?: number,
    periodicityDays?: number
  ): Date | null {
    const now = new Date();

    if (periodicityDays && periodicityDays > 0) {
      return new Date(now.getTime() + periodicityDays * 24 * 60 * 60 * 1000);
    }

    if (typeof chargeDay === 'number' && chargeDay >= 1 && chargeDay <= 31) {
      const candidate = new Date(now.getFullYear(), now.getMonth(), chargeDay);
      if (candidate <= now) {
        candidate.setMonth(candidate.getMonth() + 1);
      }
      return candidate;
    }

    return null;
  }
}
