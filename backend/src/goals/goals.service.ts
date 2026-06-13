import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { BalanceService } from '../balance/balance.service';
import { InvestmentRatesService } from '../investment-rates/investment-rates.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CancelGoalDto, CreateGoalDto, FundGoalDto, WithdrawFromGoalDto } from '../types/goal';

@Injectable()
export class GoalsService {
  constructor(
    private supabaseService: SupabaseService,
    private balanceService: BalanceService,
    private notificationsService: NotificationsService,
    private investmentRatesService: InvestmentRatesService,
  ) {}

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

  /**
   * Obtiene la tasa de meta: tasa normal - 1% (en decimal, ej. 0.02)
   */
  private async getMetaRate(): Promise<number> {
    try {
      const rates = await this.investmentRatesService.getRates();
      const normal = rates.find(r => r.type === 'normal');
      const normalPct = normal?.interestRate ?? 3.0; // porcentaje, ej. 3.0
      return Math.max(0, (normalPct - 1) / 100); // ej. (3 - 1) / 100 = 0.02
    } catch {
      // Fallback: 3% normal - 1% = 2% anual
      return 0.02;
    }
  }

  /**
   * Calcula la próxima fecha de abono según la frecuencia y última contribución
   */
  private calculateNextAbonoDate(
    lastContribDate: Date | null,
    createdAt: Date,
    frequency: string,
  ): Date {
    const base = lastContribDate ?? createdAt;
    const next = new Date(base);

    // Avanzar un período desde la base
    switch (frequency) {
      case 'diaria':
        next.setDate(next.getDate() + 1);
        break;
      case 'semanal':
        next.setDate(next.getDate() + 7);
        break;
      case 'quincenal':
        next.setDate(next.getDate() + 15);
        break;
      default: // mensual
        next.setMonth(next.getMonth() + 1);
        break;
    }

    // Si la fecha calculada ya pasó, seguir avanzando hasta el futuro
    const now = new Date();
    while (next <= now) {
      switch (frequency) {
        case 'diaria':
          next.setDate(next.getDate() + 1);
          break;
        case 'semanal':
          next.setDate(next.getDate() + 7);
          break;
        case 'quincenal':
          next.setDate(next.getDate() + 15);
          break;
        default:
          next.setMonth(next.getMonth() + 1);
          break;
      }
    }

    return next;
  }

  /**
   * Calcula el monto a abonar por período para alcanzar la meta en el plazo
   */
  private calculateMontoAPagar(
    targetAmount: number,
    progress: number,
    deadline: string,
    frequency: string,
  ): number {
    const remaining = Math.max(0, targetAmount - progress);
    if (remaining <= 0) return 0;

    const daysUntil = Math.max(
      1,
      Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    );

    let periods: number;
    switch (frequency) {
      case 'diaria':
        periods = daysUntil;
        break;
      case 'semanal':
        periods = Math.max(1, Math.ceil(daysUntil / 7));
        break;
      case 'quincenal':
        periods = Math.max(1, Math.ceil(daysUntil / 15));
        break;
      default: // mensual
        periods = Math.max(1, Math.ceil(daysUntil / 30));
        break;
    }

    // Redondear al centavo superior para asegurar que se cubra el monto
    return Math.ceil((remaining / periods) * 100) / 100;
  }

  /**
   * Calcula los rendimientos acumulados para una meta con rendimientos.
   * Solo se calcula sobre el capital abonado (progress), nunca sobre rendimientos anteriores.
   */
  private calculateRendimientos(
    progress: number,
    currentRendimientos: number,
    lastCalculationDate: Date,
    currentDate: Date,
    annualRate: number,
  ): number {
    if (progress <= 0) {
      return currentRendimientos;
    }

    // Tasa diaria = tasa anual / 365
    const dailyRate = annualRate / 365;

    // Calcular días transcurridos desde la última actualización
    const daysDiff = Math.floor(
      (currentDate.getTime() - lastCalculationDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysDiff <= 0) {
      return currentRendimientos;
    }

    // Rendimiento diario = capital * tasa diaria (sin reinversión de rendimientos)
    const dailyReturn = progress * dailyRate;
    return currentRendimientos + dailyReturn * daysDiff;
  }

  async getGoals(userId: string) {
    const goals = await this.supabaseService.getGoals(userId);

    // Obtener tasa de metas una sola vez
    const metaRate = await this.getMetaRate();

    // Procesar cada meta para verificar vencimiento automático y calcular rendimientos
    const now = new Date();
    const updatedGoals = [];

    for (const goal of goals) {
      const deadline = new Date(goal.deadline);
      const progress = Number(goal.progress || 0);
      const targetAmount = Number(goal.target_amount || goal.targetAmount || 0);
      const isExpired = goal.is_expired || goal.isExpired || false;
      const isCompleted = goal.is_completed || goal.isCompleted || false;
      const hasRendimientos = goal.has_rendimientos || goal.hasRendimientos || false;
      const currentRendimientos = Number(goal.rendimientos_generados || goal.rendimientosGenerados || 0);
      const frequency = goal.frequency || 'mensual';

      // Calcular next_abono_date y monto_a_pagar para metas activas
      const lastContribDate = goal.last_contribution_date ? new Date(goal.last_contribution_date) : null;
      const createdAt = goal.created_at ? new Date(goal.created_at) : now;
      const nextAbonoDate = (!isExpired && !isCompleted)
        ? this.calculateNextAbonoDate(lastContribDate, createdAt, frequency)
        : null;
      const montoAPagar = (!isExpired && !isCompleted && goal.deadline)
        ? this.calculateMontoAPagar(targetAmount, progress, goal.deadline, frequency)
        : 0;

      // Si la meta ya está marcada como expirada o completada, no calcular rendimientos
      if (isExpired || isCompleted) {
        updatedGoals.push({
          ...goal,
          next_abono_date: null,
          monto_a_pagar: 0,
        });
        continue;
      }

      // Calcular los rendimientos a MOSTRAR de forma idempotente.
      //
      // `rendimientos_generados` almacenado es la base "congelada" en la última
      // contribución (ver fundGoal). Aquí solo se le SUMA la acumulación
      // transcurrida desde esa fecha hasta ahora, y el resultado NO se vuelve a
      // persistir.
      //
      // BUG corregido: antes este valor se guardaba en cada lectura usando
      // last_contribution_date como ancla SIN avanzar el ancla. Como
      // last_contribution_date no cambia entre recargas, cada reload volvía a
      // sumar el mismo periodo sobre el valor ya acumulado, inflando los
      // intereses en cada recarga. Calculándolo en memoria (sin guardar),
      // recargar N veces devuelve siempre el mismo resultado.
      let displayRendimientos = currentRendimientos;

      if (hasRendimientos && progress > 0) {
        // Ancla estable: la fecha de la última contribución (o la creación).
        // NO usar updated_at: cambia cada vez que persistimos next_abono_date,
        // lo que volvería a falsear el cálculo.
        const accrualBaseDate = goal.last_contribution_date
          ? new Date(goal.last_contribution_date)
          : (goal.created_at ? new Date(goal.created_at) : now);

        displayRendimientos = this.calculateRendimientos(
          progress,
          currentRendimientos,
          accrualBaseDate,
          now,
          metaRate,
        );
      }

      // Verificar si la meta debe finalizarse automáticamente
      const hasExpiredTime = deadline <= now;

      if (hasExpiredTime) {
        // Mover el progreso al saldo disponible
        if (progress > 0) {
          const reference = `GOAL-EXPIRE-${Date.now()}`;
          await this.balanceService.addBalance(
            userId,
            progress,
            reference,
            `Meta finalizada: ${goal.name}`
          );

          await this.supabaseService.updateGoal(goal.id, userId, {
            is_expired: true,
            progress: 0,
            current_amount: 0,
            rendimientos_generados: 0,
            next_abono_date: null,
            monto_a_pagar: 0,
          });

          updatedGoals.push({
            ...goal,
            is_expired: true,
            isExpired: true,
            progress: 0,
            current_amount: 0,
            rendimientos_generados: 0,
            rendimientosGenerados: 0,
            next_abono_date: null,
            monto_a_pagar: 0,
          });
        } else {
          await this.supabaseService.updateGoal(goal.id, userId, {
            is_expired: true,
            rendimientos_generados: 0,
            next_abono_date: null,
            monto_a_pagar: 0,
          });

          updatedGoals.push({
            ...goal,
            is_expired: true,
            isExpired: true,
            rendimientos_generados: 0,
            rendimientosGenerados: 0,
            next_abono_date: null,
            monto_a_pagar: 0,
          });
        }
      } else {
        // Solo persistimos campos deterministas e idempotentes
        // (next_abono_date / monto_a_pagar). Los rendimientos NO se guardan aquí:
        // se devuelven calculados en memoria a partir de la base congelada para
        // evitar el doble conteo en cada recarga.
        const nextAbonoIso = nextAbonoDate ? nextAbonoDate.toISOString() : null;

        await this.supabaseService.updateGoal(goal.id, userId, {
          next_abono_date: nextAbonoIso,
          monto_a_pagar: montoAPagar,
        });

        updatedGoals.push({
          ...goal,
          rendimientos_generados: displayRendimientos,
          rendimientosGenerados: displayRendimientos,
          next_abono_date: nextAbonoIso,
          monto_a_pagar: montoAPagar,
        });
      }
    }

    return updatedGoals;
  }

  async getCategories() {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new BadRequestException('Supabase no configurado');
    }

    try {
      const { data, error } = await client
        .from('goal_categories')
        .select('code, label, description, icon, color, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) {
        throw new BadRequestException(`Error al obtener categorías: ${error.message}`);
      }

      return (data || []).map((cat: any) => ({
        code: cat.code,
        label: cat.label,
        description: cat.description,
        icon: cat.icon,
        color: cat.color,
      }));
    } catch (error: any) {
      throw new BadRequestException(
        `Error al obtener categorías: ${error?.message ?? 'Error desconocido'}`,
      );
    }
  }

  async createGoal(userId: string, createGoalDto: CreateGoalDto) {
    const goalCategory = createGoalDto.category ?? 'general';
    const goalFrequency = createGoalDto.frequency ?? 'mensual';
    const goalType = createGoalDto.type ?? 'sin-rendimiento';

    const goalData: any = {
      user_id: userId,
      name: createGoalDto.name,
      category: goalCategory,
      target_amount: createGoalDto.targetAmount,
      deadline: createGoalDto.deadline,
      has_rendimientos: createGoalDto.hasRendimientos ?? (goalType === 'con-rendimiento'),
      goal_type: goalType,
      frequency: goalFrequency,
      progress: 0,
      current_amount: 0,
      rendimientos_generados: 0,
      is_completed: false,
      is_expired: false,
    };

    // Agregar campos opcionales si existen
    if (createGoalDto.category) goalData.category = createGoalDto.category;
    if (createGoalDto.description) goalData.description = createGoalDto.description;
    if (createGoalDto.frequency) goalData.frequency = createGoalDto.frequency;
    if (createGoalDto.paymentType) goalData.payment_type = createGoalDto.paymentType;
    if (createGoalDto.type) goalData.goal_type = createGoalDto.type;

    // Calcular próxima fecha de abono y monto inicial
    const now = new Date();
    const deadline = createGoalDto.deadline;
    const targetAmount = createGoalDto.targetAmount;
    const nextAbonoDate = this.calculateNextAbonoDate(null, now, goalFrequency);
    const montoAPagar = deadline
      ? this.calculateMontoAPagar(targetAmount, 0, deadline, goalFrequency)
      : 0;

    goalData.next_abono_date = nextAbonoDate.toISOString();
    goalData.monto_a_pagar = montoAPagar;

    const createdGoal = await this.supabaseService.createGoal(goalData);
    // Notificar meta creada (fire-and-forget, errors handled internally)
    this.notificationsService.notifyGoalCreated(userId, createGoalDto.name);
    return createdGoal;
  }

  async fundGoal(userId: string, goalId: string, fundGoalDto: FundGoalDto) {
    try {
      // Validar monto
      if (!fundGoalDto.amount || fundGoalDto.amount <= 0) {
        throw new BadRequestException('El monto debe ser mayor a 0');
      }

      // Verificar PIN
      const isValidPin = await this.verifyPin(userId, fundGoalDto.pin);
      if (!isValidPin) {
        throw new UnauthorizedException('PIN incorrecto');
      }

      // Obtener meta actual
      const goals = await this.supabaseService.getGoals(userId);
      const goal = goals.find((g: any) => g.id === goalId);
      
      if (!goal) {
        throw new BadRequestException('Meta no encontrada');
      }

      // Verificar que la meta no esté completada
      if (goal.is_completed || goal.status === 'completed') {
        throw new BadRequestException('No se puede abonar a una meta completada');
      }

      // Verificar balance disponible usando cálculo dinámico (como en inversiones)
      const availableBalance = await this.balanceService.getAvailableBalance(userId);
      if (availableBalance.availableBalance < fundGoalDto.amount) {
        throw new BadRequestException(
          `Saldo insuficiente. Disponible: $${availableBalance.availableBalance.toFixed(2)}, Solicitado: $${fundGoalDto.amount.toFixed(2)}`
        );
      }

      // Preparar fecha actual para cálculos
      const now = new Date();
      const createdAt = goal.created_at ? new Date(goal.created_at) : now;

      // Calcular nuevo progreso
      const currentProgress = Number(goal.progress || goal.current_amount || 0) || 0;
      const targetAmount = Number(goal.target_amount || 0) || 0;
      
      if (targetAmount <= 0) {
        throw new BadRequestException('El monto objetivo de la meta debe ser mayor a 0');
      }

      // Si la meta tiene rendimientos, calcular rendimientos acumulados hasta ahora
      // (sobre el progress anterior) antes de actualizar el progress
      const hasRendimientos = goal.has_rendimientos || goal.hasRendimientos || false;
      let updatedRendimientos = Number(goal.rendimientos_generados || goal.rendimientosGenerados || 0);
      
      if (hasRendimientos && currentProgress > 0) {
        // Usar la fecha de última contribución si existe, sino usar updated_at, sino created_at
        // Esto evita recalcular rendimientos sobre períodos muy cortos
        let lastCalcDate: Date;
        if (goal.last_contribution_date) {
          lastCalcDate = new Date(goal.last_contribution_date);
        } else if (goal.updated_at) {
          lastCalcDate = new Date(goal.updated_at);
        } else if (goal.created_at) {
          lastCalcDate = new Date(goal.created_at);
        } else {
          lastCalcDate = now;
        }

        // Obtener tasa dinámica y calcular rendimientos sobre el progress actual (antes del nuevo abono)
        const metaRate = await this.getMetaRate();
        updatedRendimientos = this.calculateRendimientos(
          currentProgress,
          updatedRendimientos,
          lastCalcDate,
          now,
          metaRate,
        );
      }
      
      const newProgress = Math.min(
        currentProgress + fundGoalDto.amount,
        targetAmount
      );
      const newCurrentAmount = newProgress;
      const isCompleted = newProgress >= targetAmount;
      
      // SOLUCIÓN DEFINITIVA: Calcular progress_percentage explícitamente y asegurarse de que esté entre 0-100
      // DECIMAL(5,2) puede almacenar hasta 999.99, pero el porcentaje debe estar entre 0-100
      // Si no lo calculamos explícitamente, un trigger podría calcularlo incorrectamente
      let progressPercentage = 0;
      if (targetAmount > 0) {
        const rawPercentage = (newProgress / targetAmount) * 100;
        // Asegurar que esté entre 0 y 100, y redondear a 2 decimales
        // IMPORTANTE: Limitar a 100.00 máximo para evitar el error de overflow
        progressPercentage = Math.min(Math.max(0, Math.round(rawPercentage * 100) / 100), 100.00);
      }

      // Calcular total contribuido
      const totalContributed = Number(goal.total_contributed || 0) + fundGoalDto.amount;

      // Calcular nueva próxima fecha de abono y monto a pagar
      const goalFrequency = goal.frequency || 'mensual';
      const nextAbonoDate = this.calculateNextAbonoDate(now, createdAt ?? now, goalFrequency);
      const montoAPagar = goal.deadline
        ? this.calculateMontoAPagar(targetAmount, newProgress, goal.deadline, goalFrequency)
        : 0;

      // Preparar datos de actualización
      // Asegurar que todos los valores numéricos estén formateados correctamente para DECIMAL(15,2)

      // Formatear valores numéricos como strings con precisión de 2 decimales
      // Esto asegura que Supabase los interprete correctamente como DECIMAL
      // IMPORTANTE: Supabase puede convertir strings a números, pero debemos asegurarnos
      // de que los valores estén correctamente formateados y dentro de los límites
      const formatDecimal = (value: number, maxDecimals: number = 2): string => {
        if (isNaN(value) || !isFinite(value)) {
          throw new BadRequestException(`Valor inválido: ${value}`);
        }
        const formatted = value.toFixed(maxDecimals);
        // Verificar que el string formateado sea válido
        const parsed = parseFloat(formatted);
        if (isNaN(parsed) || !isFinite(parsed)) {
          throw new BadRequestException(`Error al formatear valor: ${value} -> ${formatted}`);
        }
        return formatted;
      };

      // Validar límites antes de formatear
      const maxDecimalValue = 999999999999999.99;
      const maxPercentageValue = 100; // DECIMAL(5,2) puede almacenar hasta 999.99, pero lógicamente debe ser 0-100
      
      if (newProgress > maxDecimalValue) {
        throw new BadRequestException('El progreso excede el límite permitido');
      }
      if (totalContributed > maxDecimalValue) {
        throw new BadRequestException('El total contribuido excede el límite permitido');
      }
      if (fundGoalDto.amount > maxDecimalValue) {
        throw new BadRequestException('El monto excede el límite permitido');
      }
      
      // Asegurar que el porcentaje esté entre 0 y 100
      // DECIMAL(5,2) puede almacenar hasta 999.99, pero lógicamente debe estar entre 0-100
      // El error de Supabase dice que debe ser menor que 10^3 (1000), así que limitamos a 99.99 para estar seguros
      const clampedPercentage = Math.min(Math.max(0, progressPercentage), 99.99);

      // SOLUCIÓN DEFINITIVA: Enviar valores DECIMAL como STRINGS, no como números
      // Supabase puede tener problemas al interpretar números grandes como DECIMAL
      // Enviarlos como strings asegura que se interpreten correctamente
      const updateData: any = {
        progress: formatDecimal(newProgress), // String, no número
        current_amount: formatDecimal(newCurrentAmount), // String, no número
        // NO incluir progress_percentage - se puede calcular en el frontend si es necesario
        is_completed: isCompleted,
        total_contributed: formatDecimal(totalContributed), // String, no número
        last_contribution_date: now.toISOString(),
        last_contribution_amount: formatDecimal(fundGoalDto.amount), // String, no número
        next_abono_date: nextAbonoDate.toISOString(),
        monto_a_pagar: montoAPagar,
      };

      // Incluir rendimientos actualizados si la meta tiene rendimientos
      if (hasRendimientos) {
        updateData.rendimientos_generados = formatDecimal(updatedRendimientos);
      }

      // Verificar que los valores formateados sean strings

      // Si la meta se completó, agregar campos adicionales
      if (isCompleted && !goal.is_completed) {
        updateData.completed_at = now.toISOString();
        updateData.status = 'completed';
      }

      // Logging detallado antes de actualizar

      // Actualizar meta (ahora incluye progress_percentage después de cambiar el tipo de dato)
      const updatedGoal = await this.supabaseService.updateGoal(goalId, userId, updateData);

      // Deduct balance (esto ya maneja la actualización del balance y la creación de transacciones)
      const reference = `GOAL-FUND-${Date.now()}`;
      await this.balanceService.deductBalance(
        userId,
        fundGoalDto.amount,
        reference,
        `Abono a meta: ${goal.name}`
      );

      // NO crear transacción adicional aquí - deductBalance ya maneja todo
      // Crear una transacción adicional causaría duplicación

      // Notificaciones de meta (fire-and-forget, errors handled internally)
      this.notificationsService.notifyGoalDeposit(userId, goal.name, fundGoalDto.amount, clampedPercentage);
      if (clampedPercentage >= 90 && !isCompleted) {
        const restante = (goal.target_amount || 0) - newCurrentAmount;
        this.notificationsService.notifyGoalAlmostComplete(userId, goal.name, restante);
      }

      return updatedGoal;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error al abonar a la meta');
    }
  }

  async withdrawFromGoal(userId: string, goalId: string, withdrawDto: WithdrawFromGoalDto) {
    // Verificar PIN
    const isValidPin = await this.verifyPin(userId, withdrawDto.pin);
    if (!isValidPin) {
      throw new UnauthorizedException('PIN incorrecto');
    }

    // Obtener meta actual
    const goals = await this.supabaseService.getGoals(userId);
    const goal = goals.find((g: any) => g.id === goalId);
    
    if (!goal) {
      throw new BadRequestException('Meta no encontrada');
    }

    // LÓGICA: Solo se pueden retirar fondos de metas SIN rendimientos
    // Las metas CON rendimientos solo se pueden cancelar (no retiros parciales)
    if (goal.has_rendimientos || goal.hasRendimientos) {
      throw new BadRequestException('Las metas con rendimientos no permiten retiros parciales. Debes cancelar la meta para retirar los fondos.');
    }

    // Verificar que haya suficiente progreso
    if (Number(goal.progress || 0) < withdrawDto.amount) {
      throw new BadRequestException('No hay suficiente dinero en la meta');
    }

    // Calcular nuevo progreso
    const newProgress = Math.max(Number(goal.progress || 0) - withdrawDto.amount, 0);
    const newCurrentAmount = newProgress;
    const isCompleted = false; // Ya no está completada si se retira

    // Actualizar meta
    const updatedGoal = await this.supabaseService.updateGoal(goalId, userId, {
      progress: newProgress,
      current_amount: newCurrentAmount,
      is_completed: isCompleted,
    });

    // Agregar al balance (sin comisión para metas sin rendimientos)
    const reference = `GOAL-WITHDRAW-${Date.now()}`;
    await this.balanceService.addBalance(
      userId,
      withdrawDto.amount,
      reference,
      `Retiro de meta: ${goal.name}`
    );

    // Nota: No crear transacción adicional aquí porque addBalance() ya actualiza el balance
    // y crea un registro en balance_transactions. Si creáramos una transacción tipo 'deposit'
    // aquí, el trigger update_balance_on_transaction la contaría nuevamente, duplicando el monto.

    return updatedGoal;
  }

  async cancelGoal(userId: string, goalId: string, cancelDto: CancelGoalDto) {
    // Verificar PIN
    const isValidPin = await this.verifyPin(userId, cancelDto.pin);
    if (!isValidPin) {
      throw new UnauthorizedException('PIN incorrecto');
    }

    // Obtener meta actual
    const goals = await this.supabaseService.getGoals(userId);
    const goal = goals.find((g: any) => g.id === goalId);
    
    if (!goal) {
      throw new BadRequestException('Meta no encontrada');
    }

    const progress = Number(goal.progress || 0);
    const hasRendimientos = goal.has_rendimientos || goal.hasRendimientos || false;
    const rendimientosGenerados = Number(goal.rendimientos_generados || goal.rendimientosGenerados || 0);
    const isCompleted = goal.is_completed || goal.isCompleted || false;

    // LÓGICA DE CANCELACIÓN:
    // - Si está COMPLETADA: se devuelve PROGRESO + RENDIMIENTOS (sin comisión)
    // - Si NO está completada Y tiene rendimientos: se retira solo el PROGRESO menos comisión de 6 pesos
    // - Los rendimientos se PIERDEN solo si NO está completada
    // - Si no había abonado (progreso = 0): no hay nada que retirar, no aplicar comisión
    let montoAReembolsar = progress;
    let comision = 0;

    if (hasRendimientos && progress > 0) {
      if (isCompleted) {
        // Si está completada: devolver PROGRESO + RENDIMIENTOS (sin comisión)
        montoAReembolsar = progress + rendimientosGenerados;
        comision = 0;
      } else {
        // Si NO está completada: aplicar comisión de 6 pesos sobre el progreso
        // Los rendimientos se pierden completamente
        comision = 6;
        montoAReembolsar = Math.max(0, progress - comision);
      }
    }

    // Si hay monto a reembolsar, devolverlo al balance
    if (montoAReembolsar > 0) {
      const reference = `GOAL-CANCEL-${Date.now()}`;
      let description = `Cancelación de meta: ${goal.name}`;
      
      if (isCompleted && hasRendimientos && rendimientosGenerados > 0) {
        description = `Cancelación de meta completada: ${goal.name}. Se devolvió el progreso ($${progress.toFixed(2)}) y los rendimientos generados ($${rendimientosGenerados.toFixed(2)}).`;
      } else if (comision > 0) {
        description = `Cancelación de meta: ${goal.name} (Comisión de $${comision} aplicada)`;
      }
      
      await this.balanceService.addBalance(
        userId,
        montoAReembolsar,
        reference,
        description
      );
    }

    // Si la meta está completada, actualizarla a "vencida" en lugar de eliminarla
    if (isCompleted) {
      await this.supabaseService.updateGoal(goalId, userId, {
        status: 'vencida',
        is_expired: true,
        is_completed: false,
        progress: 0,
        current_amount: 0,
        rendimientos_generados: 0,
      });
    } else {
      // Si no está completada, eliminar la meta
      await this.supabaseService.deleteGoal(goalId, userId);
    }

    // Mensaje de confirmación
    let message = 'Meta cancelada exitosamente.';
    if (isCompleted && hasRendimientos && rendimientosGenerados > 0) {
      message = `Meta cancelada exitosamente. Se devolvió tu progreso ($${progress.toFixed(2)}) y tus rendimientos generados ($${rendimientosGenerados.toFixed(2)}).`;
    } else if (comision > 0) {
      message = `Meta cancelada exitosamente. Se aplicó una comisión de $${comision} pesos. Los rendimientos generados se han perdido.`;
    }

    return { 
      success: true, 
      message
    };
  }
}
