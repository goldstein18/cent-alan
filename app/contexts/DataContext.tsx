import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { BalanceBreakdown, BalanceService } from '../services/balanceService';
import { GoalApiModel, GoalsService } from '../services/goalsService';
import { InvestmentService } from '../services/investmentService';
import { TransactionApiModel, TransactionsService } from '../services/transactionsService';
import { useAuth } from './AuthContext';

type InvestmentStatus = 'active' | 'matured' | 'cancelled';

export interface Investment {
  id: string;
  amount: number;
  term: number;
  interestRate: number;
  createdAt: string;
  maturityDate: string;
  status: InvestmentStatus;
  isDomiciliation?: boolean;
  oldSystem?: boolean;
  periodicity?: 'semanal' | 'quincenal' | 'mensual';
  periodicityDays?: number; // Días naturales para el período
  nextChargeDate?: string; // Fecha del próximo cargo
  isPaused?: boolean; // Si la domiciliación está pausada
  isCancelled?: boolean; // Si la domiciliación está cancelada
  chargeDay?: number; // Día del mes para el cargo (1-31)
  updatedAt?: string;
  startDate?: string; // Fecha de inicio de la inversión
}

interface Goal {
  id: string;
  name: string;
  category?: string;
  description?: string;
  targetAmount: number;
  currentAmount?: number;
  progress: number;
  createdAt: string;
  deadline: string;
  frequency?: string;
  paymentType?: string;
  type?: 'sin-rendimiento' | 'con-rendimiento';
  status?: string;
  hasRendimientos: boolean;
  rendimientosGenerados: number;
  nextAbonoDate: string;
  montoAPagar?: number;
  isCompleted: boolean;
  isExpired: boolean;
}

export interface AccountStatement {
  id: string;
  type: 'deposit' | 'internal_transfer' | 'external_transfer' | 'payment' | 'investment' | 'investment_cancellation';
  amount: number;
  description: string;
  reference: string;
  status: 'completed' | 'pending' | 'failed' | 'active' | 'matured' | 'cancelled';
  createdAt: string;
  fromAccount?: string;
  toAccount?: string;
  bankName?: string;
  clabe?: string;
  maturityDate?: string;
  termMonths?: number;
  interestRate?: number;
  investmentId?: string;
  oldSystem?: boolean;
}

type AddInvestmentInput = {
  amount: number;
  term: number;
  interestRate?: number;
  status?: InvestmentStatus;
  isDomiciliation?: boolean;
  periodicity?: 'semanal' | 'quincenal' | 'mensual';
  periodicityDays?: number;
  nextChargeDate?: string;
  isPaused?: boolean;
  isCancelled?: boolean;
  chargeDay?: number;
  oldSystem?: boolean;
};

interface DataContextType {
  investments: Investment[];
  goals: Goal[];
  accountStatements: AccountStatement[];
  availableBalance?: number;
  totalBalance?: number;
  balanceBreakdown?: BalanceBreakdown;
  reloadData: () => Promise<void>;
  addInvestment: (investment: AddInvestmentInput & { pin: string }) => Promise<void>;
  addDomiciliation: (domiciliation: { amount: number; periodicity: 'diaria' | 'semanal' | 'quincenal' | 'mensual'; chargeDay: number; startDate?: string; term?: number; pin: string }) => Promise<void>;
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt' | 'deadline' | 'hasRendimientos' | 'rendimientosGenerados' | 'nextAbonoDate' | 'isCompleted' | 'isExpired'> & { deadline?: string }) => Promise<void>;
  addAccountStatement: (statement: Omit<AccountStatement, 'id' | 'createdAt'>) => void;
  abonarAMeta: (goalId: string, amount: number, pin: string) => Promise<void>;
  retirarDeMeta: (goalId: string, amount: number, pin: string) => Promise<void>;
  cancelarMeta: (goalId: string, pin: string) => Promise<void>;
  calcularRendimientos: (goalId: string) => void;
  pauseDomiciliation: (investmentId: string) => Promise<void>;
  resumeDomiciliation: (investmentId: string) => Promise<void>;
  cancelDomiciliation: (investmentId: string) => Promise<void>;
  updateDomiciliationSchedule: (investmentId: string, amount: number, periodicity: string, startDate: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, user } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accountStatements, setAccountStatements] = useState<AccountStatement[]>([]);
  const [availableBalance, setAvailableBalance] = useState<number | undefined>(undefined);
  const [totalBalance, setTotalBalance] = useState<number | undefined>(undefined);
  const [balanceBreakdown, setBalanceBreakdown] = useState<BalanceBreakdown | undefined>(undefined);

  const [isLoading, setIsLoading] = useState(false);
  const isReloadingRef = React.useRef(false);

  const normalizeInvestmentStatus = useCallback((
    rawStatus?: string,
    maturityDate?: string,
    isCancelled?: boolean,
  ): InvestmentStatus => {
    if (isCancelled) return 'cancelled';

    const status = (rawStatus || '').toLowerCase();
    if (status === 'cancelled' || status === 'canceled' || status === 'cancelada') return 'cancelled';

    // En migrados, "completed" no siempre implica vencida.
    // La fecha de vencimiento es la fuente de verdad.
    if (maturityDate) {
      const maturity = new Date(maturityDate);
      if (!Number.isNaN(maturity.getTime())) {
        const now = new Date();
        if (maturity.getTime() < now.getTime()) {
          return 'matured';
        }
      }
    }

    if (status === 'matured' || status === 'vencida' || status === 'vencido') return 'matured';
    if (status === 'cancelled' || status === 'canceled' || status === 'cancelada') return 'cancelled';

    if (status === 'active' || status === 'activa') return 'active';
    return 'active';
  }, []);

  const toBoolean = useCallback((value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 't', 'yes', 'si', 'sí'].includes(normalized)) return true;
      if (['false', '0', 'f', 'no', 'null', ''].includes(normalized)) return false;
    }
    return Boolean(value);
  }, []);

  const normalizeTransaction = useCallback((raw: TransactionApiModel): AccountStatement => {
    const amountValue = raw.amount ?? 0;
    const createdAtValue = raw.created_at ?? new Date().toISOString();
    const statusValue = (raw.status || 'completed') as AccountStatement['status'];
    const referenceValue = raw.reference ?? '';
    const descriptionValue = raw.description ?? 'Movimiento en tu cuenta';
    const toAccountValue = raw.to_account ?? (raw as any)?.toAccount ?? undefined;
    const bankNameValue = raw.bank_name ?? (raw as any)?.bankName ?? undefined;
    const clabeValue = raw.clabe ?? (raw as any)?.clabe ?? undefined;

    let mappedType: AccountStatement['type'];
    switch (raw.type) {
      case 'internal_transfer':
        mappedType = 'internal_transfer';
        break;
      case 'external_transfer':
        mappedType = 'external_transfer';
        break;
      case 'payment':
        mappedType = 'payment';
        break;
      case 'withdrawal':
        mappedType = 'payment';
        break;
      case 'investment':
        mappedType = 'investment';
        break;
      case 'investment_cancellation':
        mappedType = 'investment_cancellation';
        break;
      case 'deposit':
      default:
        mappedType = 'deposit';
        break;
    }

    return {
      id: raw.id,
      type: mappedType,
      amount: Number(amountValue),
      description: descriptionValue,
      reference: referenceValue,
      status: statusValue,
      createdAt: createdAtValue,
      toAccount: toAccountValue || undefined,
      bankName: bankNameValue || undefined,
      clabe: clabeValue || undefined,
    };
  }, []);

  const fetchAccountStatements = useCallback(async () => {
    if (!isLoggedIn || !user?.id) {
      setAccountStatements([]);
      return [];
    }

    const response = await TransactionsService.getUserTransactions();

    if (response.success && response.data) {
      const mappedStatements = response.data
        .map(transaction => normalizeTransaction(transaction));

      const sortedStatements = mappedStatements.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      setAccountStatements(sortedStatements);
      return sortedStatements;
    } else {
      console.error('Error al cargar transacciones:', response.error);
      return null;
    }
  }, [isLoggedIn, user?.id, normalizeTransaction]);

  const fetchInvestments = useCallback(async () => {
    if (!isLoggedIn || !user?.id) {
      setInvestments([]);
      return;
    }

    const response = await InvestmentService.getUserInvestments();

    if (response.success && response.data) {
      const mappedInvestments: Investment[] = response.data.map((raw: any) => {
        const amountValue = raw.amount ?? raw.Amount;
        const termValue = raw.term ?? raw.termMonths ?? raw.term_months;
        // Prefer the rate coming from the backend; if absent, leave undefined (no hardcoded default)
        const interestRateValue = raw.interestRate ?? raw.interest_rate;
        const createdAtValue = raw.createdAt ?? raw.created_at;
        const maturityDateValue = raw.maturityDate ?? raw.maturity_date;
        const periodicityValue = raw.periodicity ?? raw.periodicity_type;
        const periodicityDaysValue = raw.periodicityDays ?? raw.periodicity_days;
        const nextChargeDateValue = raw.nextChargeDate ?? raw.next_charge_date;
        const isPausedValue = raw.isPaused ?? raw.is_paused;
        const isCancelledValue = raw.isCancelled ?? raw.is_cancelled;
        const chargeDayValue = raw.chargeDay ?? raw.charge_day;
        const updatedAtValue = raw.updatedAt ?? raw.updated_at;

        // Normalize interest rate only when provided:
        // - if < 1, treat as decimal (0.074 -> 7.4)
        // - if >= 1, already percentage (10.5 -> 10.5)
        const rawRate = interestRateValue === undefined || interestRateValue === null
          ? undefined
          : Number(interestRateValue);
        const normalizedRate =
          rawRate === undefined || Number.isNaN(rawRate)
            ? undefined
            : (rawRate < 1 ? rawRate * 100 : rawRate);

        return {
          id: raw.id,
          amount: Number(amountValue ?? 0),
          term: Number(termValue ?? 0),
          interestRate: normalizedRate,
          createdAt: createdAtValue ?? new Date().toISOString(),
          maturityDate: maturityDateValue ?? new Date().toISOString(),
          status: normalizeInvestmentStatus(raw.status, maturityDateValue, toBoolean(isCancelledValue)),
          isDomiciliation: toBoolean(raw.isDomiciliation ?? raw.is_domiciliation ?? false),
          oldSystem: toBoolean(raw.oldSystem ?? raw.old_system ?? false),
          periodicity: periodicityValue ?? undefined,
          periodicityDays: periodicityDaysValue ?? undefined,
          nextChargeDate: nextChargeDateValue ?? undefined,
          isPaused: isPausedValue === undefined || isPausedValue === null ? undefined : toBoolean(isPausedValue),
          isCancelled: isCancelledValue === undefined || isCancelledValue === null ? undefined : toBoolean(isCancelledValue),
          chargeDay: chargeDayValue ?? undefined,
          updatedAt: updatedAtValue ?? undefined,
        };
      });

      setInvestments(mappedInvestments);
    } else {
      console.error('Error al cargar inversiones:', response.error);
    }
  }, [isLoggedIn, user?.id, normalizeInvestmentStatus, toBoolean]);

  const fetchBalances = useCallback(async () => {
    if (!isLoggedIn || !user?.id) {
      setAvailableBalance(undefined);
      setTotalBalance(undefined);
      setBalanceBreakdown(undefined);
      return;
    }

    try {
      // Try to get both balances, but handle errors gracefully
      const [availableResult, totalResult] = await Promise.allSettled([
        BalanceService.getAvailableBalance(),
        BalanceService.getTotalBalance(),
      ]);

      // Process available balance
      if (availableResult.status === 'fulfilled') {
        setAvailableBalance(availableResult.value.availableBalance ?? 0);
        setBalanceBreakdown(availableResult.value.breakdown);
      } else {
        console.error('Error al cargar saldo disponible:', availableResult.reason);
      }

      // Process total balance
      if (totalResult.status === 'fulfilled') {
        const totalBalanceValue = totalResult.value.totalBalance ?? (availableResult.status === 'fulfilled' ? availableResult.value.availableBalance ?? 0 : 0);
        setTotalBalance(totalBalanceValue);
        // Use breakdown from total if available, otherwise from available
        if (totalResult.value.breakdown) {
          setBalanceBreakdown(totalResult.value.breakdown);
        }
      } else {
        console.error('Error al cargar dinero total:', totalResult.reason);
        // Fallback: use available balance as total if total failed
        if (availableResult.status === 'fulfilled') {
          const available = availableResult.value.availableBalance ?? 0;
          setTotalBalance(available);
        }
      }
    } catch (error) {
      console.error('Error al cargar balances:', error);
      // Set defaults to prevent UI crashes
      setAvailableBalance(0);
      setTotalBalance(0);
    }
  }, [isLoggedIn, user?.id]);

  const fetchGoals = useCallback(async () => {
    if (!isLoggedIn || !user?.id) {
      setGoals([]);
      return;
    }

    const response = await GoalsService.getUserGoals();

    if (response.success && response.data) {
      const mappedGoals: Goal[] = response.data.map((raw: GoalApiModel) => {
        return {
          id: raw.id,
          name: raw.name,
          category: raw.category,
          description: raw.description,
          targetAmount: raw.target_amount,
          currentAmount: raw.current_amount,
          progress: raw.progress,
          createdAt: raw.created_at,
          deadline: raw.deadline,
          frequency: raw.frequency,
          paymentType: raw.payment_type,
          type: raw.type,
          status: raw.status,
          hasRendimientos: raw.has_rendimientos,
          rendimientosGenerados: raw.rendimientos_generados ?? 0,
          nextAbonoDate: raw.next_abono_date,
          montoAPagar: raw.monto_a_pagar ?? 0,
          isCompleted: raw.is_completed,
          isExpired: raw.is_expired,
        };
      });

      setGoals(mappedGoals);
    } else {
      console.error('Error al cargar metas:', response.error);
    }
  }, [isLoggedIn, user?.id]);

  const reloadData = useCallback(async () => {
    if (!isLoggedIn || !user?.id || isReloadingRef.current) {
      return;
    }

    isReloadingRef.current = true;
    setIsLoading(true);
    try {
      await Promise.all([
        fetchAccountStatements(),
        fetchInvestments(),
        fetchGoals(),
        fetchBalances(),
      ]);
    } finally {
      setIsLoading(false);
      isReloadingRef.current = false;
    }
  }, [isLoggedIn, user?.id, fetchAccountStatements, fetchInvestments, fetchGoals, fetchBalances]);

  useEffect(() => {
    reloadData();
  }, [reloadData]);

  const addInvestment = async (investmentData: AddInvestmentInput & { pin: string }) => {
    try {
      const response = await InvestmentService.createInvestment({
        amount: investmentData.amount,
        term: investmentData.term,
        pin: investmentData.pin,
      });

      if (response.success && response.data) {
        const raw = response.data;
        const newInvestment: Investment = {
          id: raw.id,
          amount: raw.amount,
          term: raw.term,
          interestRate: raw.interest_rate,
          createdAt: raw.created_at,
          maturityDate: raw.maturity_date,
          status: normalizeInvestmentStatus(raw.status, raw.maturity_date, toBoolean(raw.is_cancelled)),
          isDomiciliation: raw.is_domiciliation ?? false,
          oldSystem: toBoolean(raw.oldSystem ?? raw.old_system ?? false),
          periodicity: raw.periodicity,
          periodicityDays: raw.periodicity_days,
          nextChargeDate: raw.next_charge_date,
          isPaused: raw.is_paused,
          isCancelled: raw.is_cancelled,
          chargeDay: raw.charge_day,
          updatedAt: raw.updated_at,
        };
        setInvestments(prev => [newInvestment, ...prev]);
        try {
          await reloadData(); // Refresh to get updated balances
        } catch (reloadError) {
          // reloadData failing does NOT mean the investment failed — ignore silently
        }
      } else {
        throw new Error(response.error || 'Error al crear la inversión');
      }
    } catch (error) {
      console.error('Error creating investment:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Error al crear la inversión');
      throw error;
    }
  };

  const addDomiciliation = async (domiciliationData: { amount: number; periodicity: 'diaria' | 'semanal' | 'quincenal' | 'mensual'; chargeDay: number; startDate?: string; term?: number; pin: string }) => {
    try {
      const response = await InvestmentService.createDomiciliation(domiciliationData);

      if (response.success && response.data) {
        const raw = response.data;
        const newInvestment: Investment = {
          id: raw.id,
          amount: raw.amount,
          term: raw.term ?? 12,
          interestRate: raw.interest_rate,
          createdAt: raw.created_at,
          maturityDate: raw.maturity_date,
          status: normalizeInvestmentStatus(raw.status, raw.maturity_date, toBoolean(raw.is_cancelled)),
          isDomiciliation: true,
          oldSystem: toBoolean(raw.oldSystem ?? raw.old_system ?? false),
          periodicity: raw.periodicity,
          periodicityDays: raw.periodicity_days,
          nextChargeDate: raw.next_charge_date,
          isPaused: raw.is_paused,
          isCancelled: raw.is_cancelled,
          chargeDay: raw.charge_day,
          updatedAt: raw.updated_at,
        };
        setInvestments(prev => [newInvestment, ...prev]);
        await reloadData(); // Refresh to get updated balances
      } else {
        throw new Error(response.error || 'Error al crear la domiciliación');
      }
    } catch (error) {
      console.error('Error creating domiciliation:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Error al crear la domiciliación');
      throw error;
    }
  };

  const addGoal = async (goalData: Omit<Goal, 'id' | 'createdAt' | 'deadline' | 'hasRendimientos' | 'rendimientosGenerados' | 'nextAbonoDate' | 'isCompleted' | 'isExpired'> & { deadline?: string }) => {
    try {
      const response = await GoalsService.createGoal({
        name: goalData.name,
        category: goalData.category,
        description: goalData.description,
        targetAmount: goalData.targetAmount,
        deadline: goalData.deadline || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        frequency: goalData.frequency,
        paymentType: goalData.paymentType,
        type: goalData.type,
      });

      if (response.success && response.data) {
        const raw = response.data;
        const newGoal: Goal = {
          id: raw.id,
          name: raw.name,
          category: raw.category,
          description: raw.description,
          targetAmount: raw.target_amount,
          currentAmount: raw.current_amount,
          progress: raw.progress,
          createdAt: raw.created_at,
          deadline: raw.deadline,
          frequency: raw.frequency,
          paymentType: raw.payment_type,
          type: raw.type,
          status: raw.status,
          hasRendimientos: raw.has_rendimientos,
          rendimientosGenerados: raw.rendimientos_generados ?? 0,
          nextAbonoDate: raw.next_abono_date,
          montoAPagar: raw.monto_a_pagar ?? 0,
          isCompleted: raw.is_completed,
          isExpired: raw.is_expired,
        };
        setGoals(prev => [newGoal, ...prev]);
        await reloadData(); // Refresh to get updated balances
      } else {
        throw new Error(response.error || 'Error al crear la meta');
      }
    } catch (error) {
      console.error('Error creating goal:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Error al crear la meta');
      throw error;
    }
  };

  const abonarAMeta = async (goalId: string, amount: number, pin: string) => {
    try {
      const response = await GoalsService.fundGoal(goalId, { amount, pin });

      if (response.success && response.data) {
        // NO actualizar el estado manualmente aquí - dejar que reloadData() lo haga
        // Esto evita duplicación de cantidades
        await reloadData();
      } else {
        throw new Error(response.error || 'Error al abonar a la meta');
      }
    } catch (error) {
      console.error('Error funding goal:', error);
      // No mostrar Alert aquí, dejar que el componente maneje el error
      throw error;
    }
  };

  const retirarDeMeta = async (goalId: string, amount: number, pin: string) => {
    try {
      const response = await GoalsService.withdrawFromGoal(goalId, { amount, pin });

      if (response.success && response.data) {
        // NO actualizar el estado manualmente aquí - dejar que reloadData() lo haga
        // Esto evita duplicación de cantidades
        await reloadData(); // Refresh to get updated balances
      } else {
        throw new Error(response.error || 'Error al retirar de la meta');
      }
    } catch (error) {
      console.error('Error withdrawing from goal:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Error al retirar de la meta');
      throw error;
    }
  };

  const cancelarMeta = async (goalId: string, pin: string) => {
    try {
      const response = await GoalsService.cancelGoal(goalId, pin);

      if (response.success) {
        // No eliminar la meta de la lista aquí - reloadData() la actualizará
        // Si la meta está completada, se actualizará a "vencida"
        // Si no está completada, se eliminará del backend y reloadData() la quitará de la lista
        await reloadData(); // Refresh to get updated balances and goals
      } else {
        throw new Error(response.error || 'Error al cancelar la meta');
      }
    } catch (error) {
      console.error('Error canceling goal:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Error al cancelar la meta');
      throw error;
    }
  };

  const calcularRendimientos = (goalId: string) => {
    setGoals(prev => prev.map(goal => {
      if (goal.id === goalId && goal.hasRendimientos) {
        // Calcular rendimientos diarios (4% anual / 365 días)
        const dailyRate = 0.04 / 365;
        const daysSinceLastCalculation = Math.floor((Date.now() - new Date(goal.createdAt).getTime()) / (24 * 60 * 60 * 1000));
        const newRendimientos = goal.rendimientosGenerados + (goal.progress * dailyRate * daysSinceLastCalculation);
        
        return {
          ...goal,
          rendimientosGenerados: newRendimientos,
        };
      }
      return goal;
    }));
  };

  const pauseDomiciliation = async (investmentId: string) => {
    try {
      const response = await InvestmentService.manageDomiciliation(investmentId, { action: 'pause' });

      if (response.success && response.data) {
        const raw = response.data;
        setInvestments(prev => prev.map(investment => {
          if (investment.id === investmentId) {
            return {
              ...investment,
              isPaused: raw.is_paused ?? true,
              isCancelled: raw.is_cancelled ?? false,
            };
          }
          return investment;
        }));
        await reloadData();
      } else {
        throw new Error(response.error || 'Error al pausar la domiciliación');
      }
    } catch (error) {
      console.error('Error pausing domiciliation:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Error al pausar la domiciliación');
      throw error;
    }
  };

  const resumeDomiciliation = async (investmentId: string) => {
    try {
      const response = await InvestmentService.manageDomiciliation(investmentId, { action: 'resume' });

      if (response.success && response.data) {
        const raw = response.data;
        setInvestments(prev => prev.map(investment => {
          if (investment.id === investmentId) {
            return {
              ...investment,
              isPaused: raw.is_paused ?? false,
              isCancelled: raw.is_cancelled ?? false,
            };
          }
          return investment;
        }));
        await reloadData();
      } else {
        throw new Error(response.error || 'Error al reanudar la domiciliación');
      }
    } catch (error) {
      console.error('Error resuming domiciliation:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Error al reanudar la domiciliación');
      throw error;
    }
  };

  const cancelDomiciliation = async (investmentId: string) => {
    try {
      const response = await InvestmentService.manageDomiciliation(investmentId, { action: 'cancel' });

      if (response.success && response.data) {
        const raw = response.data;
        setInvestments(prev => prev.map(investment => {
          if (investment.id === investmentId) {
            return {
              ...investment,
              isCancelled: raw.is_cancelled ?? true,
              isPaused: raw.is_paused ?? false,
            };
          }
          return investment;
        }));
        await reloadData();
      } else {
        throw new Error(response.error || 'Error al cancelar la domiciliación');
      }
    } catch (error) {
      console.error('Error canceling domiciliation:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Error al cancelar la domiciliación');
      throw error;
    }
  };

  const updateDomiciliationSchedule = async (investmentId: string, amount: number, periodicity: string, startDate: string) => {
    try {
      const response = await InvestmentService.manageDomiciliation(investmentId, {
        action: 'update_schedule',
        amount,
        periodicity,
        startDate,
      });

      if (response.success && response.data) {
        const raw = response.data;
        setInvestments(prev => prev.map(investment => {
          if (investment.id === investmentId) {
            return {
              ...investment,
              amount: raw.amount,
              periodicity: raw.periodicity,
              periodicityDays: raw.periodicity_days,
              nextChargeDate: raw.next_charge_date,
              startDate: raw.start_date,
            };
          }
          return investment;
        }));
        await reloadData();
      } else {
        throw new Error(response.error || 'Error al actualizar la domiciliación');
      }
    } catch (error) {
      console.error('Error updating domiciliation schedule:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Error al actualizar la domiciliación');
      throw error;
    }
  };

  const addAccountStatement = (statementData: Omit<AccountStatement, 'id' | 'createdAt'>) => {
    const newStatement: AccountStatement = {
      ...statementData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    setAccountStatements(prev => [newStatement, ...prev]);
  };

  return (
    <DataContext.Provider value={{ 
      investments, 
      goals, 
      accountStatements, 
      availableBalance,
      totalBalance,
      balanceBreakdown,
      reloadData,
      addInvestment,
      addDomiciliation,
      addGoal, 
      addAccountStatement,
      abonarAMeta,
      retirarDeMeta,
      cancelarMeta,
      calcularRendimientos,
      pauseDomiciliation,
      resumeDomiciliation,
      cancelDomiciliation,
      updateDomiciliationSchedule
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
