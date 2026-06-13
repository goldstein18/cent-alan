import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { InvestmentRecord, InvestmentStatus } from '../types/investment';

const GOALS_TABLE_NAME = 'new_goals';
const GOALS_CACHE_SCOPE = 'new_goals';

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

@Injectable()
export class SupabaseService {
  private supabase: SupabaseClient;
  private supabaseAdmin: SupabaseClient;
  private readonly cacheTTL: number;

  private userCache = new Map<string, CacheEntry<any>>();
  private transactionsCache = new Map<string, CacheEntry<any[]>>();
  private investmentsCache = new Map<string, CacheEntry<InvestmentRecord[]>>();
  private goalsCache = new Map<string, CacheEntry<any[]>>();

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    const serviceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    const ttlFromEnv = Number(this.configService.get<string>('SUPABASE_CACHE_TTL_MS') ?? '3000');
    this.cacheTTL = Number.isFinite(ttlFromEnv) && ttlFromEnv > 0 ? ttlFromEnv : 0;
    
    // Solo inicializar Supabase si las credenciales están configuradas y son válidas
    if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    } else {
    }

    // Inicializar cliente de administración con service role
    if (supabaseUrl && serviceRoleKey && supabaseUrl.startsWith('http')) {
      this.supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    }
  }

  private getFromCache<T>(store: Map<string, CacheEntry<T>>, key: string): T | null {
    if (this.cacheTTL <= 0) {
      return null;
    }

    const entry = store.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(store: Map<string, CacheEntry<T>>, key: string, data: T): void {
    if (this.cacheTTL <= 0) {
      return;
    }

    store.set(key, {
      data,
      expiresAt: Date.now() + this.cacheTTL,
    });
  }

  private buildCacheKey(scope: string, payload: Record<string, unknown>): string {
    return JSON.stringify({ scope, ...payload });
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);
  }

  private invalidateCache(store: Map<string, CacheEntry<any>>, matcher: (key: string) => boolean) {
    for (const key of store.keys()) {
      if (matcher(key)) {
        store.delete(key);
      }
    }
  }

  private invalidateUserDataCaches(userId: string) {
    const matcher = (key: string) => key.includes(`"userId":"${userId}"`);
    this.invalidateCache(this.transactionsCache, matcher);
    this.invalidateCache(this.investmentsCache, matcher);
    this.invalidateCache(this.goalsCache, matcher);
    for (const [key, entry] of this.userCache.entries()) {
      const candidate = entry?.data as { id?: string } | undefined;
      if (key === userId || candidate?.id === userId) {
        this.userCache.delete(key);
      }
    }
  }

  private normalizePhoneDigits(phone?: string): string | undefined {
    if (!phone) {
      return undefined;
    }
    const digits = phone.replace(/\D/g, '');
    return digits.length > 0 ? digits : undefined;
  }

  private buildPhoneVariants(phone?: string): string[] {
    const digits = this.normalizePhoneDigits(phone);
    if (!digits) {
      return [];
    }

    const variants = new Set<string>();
    variants.add(digits);

    if (digits.length === 10) {
      variants.add(`52${digits}`);
      variants.add(`+52${digits}`);
      variants.add(`+521${digits}`);
    } else if (digits.length === 12 && digits.startsWith('52')) {
      const last10 = digits.slice(-10);
      variants.add(last10);
      variants.add(`+52${last10}`);
      variants.add(`+521${last10}`);
    } else if (digits.length === 12 && digits.startsWith('521')) {
      const last10 = digits.slice(-10);
      variants.add(last10);
      variants.add(`52${last10}`);
      variants.add(`+52${last10}`);
    } else if (digits.length === 13 && digits.startsWith('521')) {
      const last10 = digits.slice(-10);
      variants.add(last10);
      variants.add(`52${last10}`);
      variants.add(`+52${last10}`);
    }

    return Array.from(variants);
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  getAdminClient(): SupabaseClient {
    return this.supabaseAdmin;
  }

  // Métodos de conveniencia para operaciones comunes
  async getAdminUserById(adminId: string) {
    const client = this.supabaseAdmin ?? this.supabase;

    if (!client) {
      return null;
    }

    if (!adminId) {
      return null;
    }

    const { data, error } = await client
      .from('admin_users')
      .select('*')
      .eq('id', adminId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      if (error.code && ['PGRST116', 'PGRST204'].includes(error.code)) {
        return null;
      }
      throw error;
    }

    return data ?? null;
  }

  async getUser(identifier: string) {
    if (!identifier) {
      return null;
    }

    const normalizedIdentifier = identifier.trim();
    const cachedUser = this.getFromCache(this.userCache, normalizedIdentifier);
    if (cachedUser) {
      return cachedUser;
    }

    if (!this.supabase) {
      return null;
    }

    const client = this.supabaseAdmin ?? this.supabase;
    if (!client) {
      return null;
    }

    // Solo buscar por ID si es UUID válido; evita errores “invalid input syntax for type uuid”
    if (this.isUuid(normalizedIdentifier)) {
    const { data: userById, error: userByIdError } = await client
      .from('app_users')
      .select('*')
      .eq('id', normalizedIdentifier)
      .maybeSingle();

    if (userByIdError && !['PGRST116', 'PGRST204'].includes(userByIdError.code ?? '')) {
      throw userByIdError;
    }

    if (userById) {
      this.setCache(this.userCache, userById.id, userById);
      if (normalizedIdentifier !== userById.id) {
        this.setCache(this.userCache, normalizedIdentifier, userById);
      }
      if (userById.phone_number) {
        for (const variant of this.buildPhoneVariants(userById.phone_number)) {
          this.setCache(this.userCache, variant, userById);
        }
      }
      return userById;
      }
    }

    const phoneVariants = this.buildPhoneVariants(normalizedIdentifier);

    if (phoneVariants.length > 0) {
      for (const variant of phoneVariants) {
        const cachedVariant = this.getFromCache(this.userCache, variant);
        if (cachedVariant) {
          return cachedVariant;
        }
      }

      const { data: users, error } = await client
        .from('app_users')
        .select('*')
        .in('phone_number', phoneVariants)
        .limit(1);

      if (error) {
        if (!error.code || !['PGRST116', 'PGRST204'].includes(error.code)) {
          throw error;
        }
      } else if (users && users.length > 0) {
        const user = users[0];
        if (user?.id) {
          this.setCache(this.userCache, user.id, user);
        }
        for (const variant of phoneVariants) {
          this.setCache(this.userCache, variant, user);
        }
        return user;
      }
    }

    const digits = this.normalizePhoneDigits(normalizedIdentifier);
    if (digits) {
      const cachedDigits = this.getFromCache(this.userCache, digits);
      if (cachedDigits) {
        return cachedDigits;
      }

      const { data: likeUsers, error: likeError } = await client
          .from('app_users')
          .select('*')
        .ilike('phone_number', `%${digits}`)
        .limit(1);

      if (likeError && !['PGRST116', 'PGRST204'].includes(likeError.code ?? '')) {
        throw likeError;
      }

      if (likeUsers && likeUsers.length > 0) {
        const user = likeUsers[0];
        if (user?.id) {
          this.setCache(this.userCache, user.id, user);
        }
        for (const variant of this.buildPhoneVariants(user?.phone_number)) {
          this.setCache(this.userCache, variant, user);
        }
        this.setCache(this.userCache, normalizedIdentifier, user);
        return user;
      }
    }

    return null;
  }

  async createUser(userData: any) {
    if (!this.supabase) {
      throw new Error('Supabase no configurado');
    }

        const { data, error } = await this.supabase
          .from('app_users')
          .insert(userData)
          .select()
          .single();
    
    if (error) throw error;
    if (data?.id) {
      this.invalidateUserDataCaches(data.id);
    }
    return data;
  }

  async updateUser(userId: string, updates: any) {
    if (!this.supabase) {
      throw new Error('Supabase no configurado');
    }

        const { data, error } = await this.supabase
          .from('app_users')
          .update(updates)
          .eq('id', userId)
          .select()
          .single();
    
    if (error) throw error;
    this.invalidateUserDataCaches(userId);
    return data;
  }

  async getTransactions(userId: string, filters?: any) {
    const client = this.supabaseAdmin ?? this.supabase;

    if (!client) {
      return [];
    }

    const cacheKey = this.buildCacheKey('transactions', { userId, filters });
    const cached = this.getFromCache(this.transactionsCache, cacheKey);
    if (cached) {
      return cached;
    }

    let query = client
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (filters?.type) {
      query = query.eq('type', filters.type);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    const result = data ?? [];
    this.setCache(this.transactionsCache, cacheKey, result);
    return result;
  }

  async createTransaction(transactionData: any) {
    const client = this.supabaseAdmin ?? this.supabase;

    if (!client) {
      throw new Error('Supabase no configurado');
    }

    const { data, error } = await client
      .from('transactions')
      .insert(transactionData)
      .select()
      .single();
    
    if (error) throw error;

    if (transactionData?.user_id) {
      this.invalidateUserDataCaches(transactionData.user_id);
    }

    return data;
  }

  async createExternalTransfer(
    userId: string,
    transferData: {
      beneficiaryName: string;
      bankName: string;
      clabe: string;
      amount: number;
      description?: string;
      reference: string;
      status?: string;
      feeAmount?: number;
      taxAmount?: number;
      metadata?: Record<string, any>;
      transactionId: string;
    }
  ) {
    const client = this.supabaseAdmin ?? this.supabase;

    if (!client) {
      throw new Error('Supabase no configurado');
    }

    const { data, error } = await client
      .from('external_transfers')
      .insert({
        user_id: userId,
        transaction_id: transferData.transactionId,
        beneficiary_name: transferData.beneficiaryName,
        bank_name: transferData.bankName,
        clabe: transferData.clabe,
        amount: transferData.amount,
        description: transferData.description,
        reference: transferData.reference,
        status: transferData.status ?? 'completed',
        fee_amount: transferData.feeAmount ?? 0,
        tax_amount: transferData.taxAmount ?? 0,
        metadata: transferData.metadata ?? {},
      })
      .select('*')
      .single();
    
    if (error) throw error;
    return data;
  }

  async getExternalTransfers(
    userId?: string,
    limit = 50,
    filters?: {
      status?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    }
  ) {
    const client = this.supabaseAdmin ?? this.supabase;

    if (!client) {
      return [];
    }

    let query = client
      .from('external_transfers')
      .select(`
        id,
        user_id,
        transaction_id,
        beneficiary_name,
        bank_name,
        clabe,
        amount,
        description,
        reference,
        status,
        fee_amount,
        tax_amount,
        metadata,
        created_at,
        updated_at,
        user:app_users!external_transfers_user_id_fkey(id, first_name, last_name, phone_number, email)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }

    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }

    if (filters?.search) {
      const sanitized = filters.search.replace(/[%]/g, '');
      query = query.or(
        `reference.ilike.%${sanitized}%,beneficiary_name.ilike.%${sanitized}%`
      );
    }

    const { data, error } = await query;

    if (error) throw error;

    return (data ?? []).map((row: any) => {
      const userNode = Array.isArray(row.user) ? row.user[0] : row.user;
      const emitterName = userNode
        ? `${userNode.first_name || ''} ${userNode.last_name || ''}`.trim() || null
        : null;
      return {
        ...row,
        emitter_name: emitterName,
        emitter_phone: userNode?.phone_number || null,
        emitter_email: userNode?.email || null,
      };
    });
  }

  async getInvestments(userId: string): Promise<InvestmentRecord[]> {
    const client = this.supabaseAdmin ?? this.supabase;

    if (!client) {
      return [];
    }

    const cacheKey = this.buildCacheKey('investments', { userId });
    const cached = this.getFromCache(this.investmentsCache, cacheKey);
    if (cached) {
      return cached;
    }

    const { data, error } = await client
      .from('investments')
      .select(this.investmentSelectFields)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    const result = (data ?? []).map(row => this.mapInvestmentRow(row));
    this.setCache(this.investmentsCache, cacheKey, result);
    return result;
  }

  async getInvestmentById(userId: string, investmentId: string): Promise<InvestmentRecord | null> {
    const client = this.supabaseAdmin ?? this.supabase;

    if (!client) {
      return null;
    }

    const { data, error } = await client
      .from('investments')
      .select(this.investmentSelectFields)
      .eq('id', investmentId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return this.mapInvestmentRow(data);
  }

  async createInvestment(investmentData: any): Promise<InvestmentRecord> {
    const client = this.supabaseAdmin ?? this.supabase;

    if (!client) {
      throw new Error('Supabase no configurado');
    }

    const { data, error } = await client
      .from('investments')
      .insert(investmentData)
      .select(this.investmentSelectFields)
      .single();
    
    if (error) throw error;
    const mapped = this.mapInvestmentRow(data);
    if (investmentData?.user_id) {
      this.invalidateUserDataCaches(investmentData.user_id);
    }
    return mapped;
  }

  async updateInvestment(
    investmentId: string,
    userId: string,
    updates: Record<string, any>
  ): Promise<InvestmentRecord> {
    const client = this.supabaseAdmin ?? this.supabase;

    if (!client) {
      throw new Error('Supabase no configurado');
    }

    const { data, error } = await client
      .from('investments')
      .update(updates)
      .eq('id', investmentId)
      .eq('user_id', userId)
      .select(this.investmentSelectFields)
      .single();

    if (error) throw error;
    const mapped = this.mapInvestmentRow(data);
    this.invalidateUserDataCaches(userId);
    return mapped;
  }

  async getGoals(userId: string) {
    const client = this.supabaseAdmin ?? this.supabase;
    if (!client) {
      return [];
    }

    const cacheKey = this.buildCacheKey(GOALS_CACHE_SCOPE, { userId });
    const cached = this.getFromCache(this.goalsCache, cacheKey);
    if (cached) {
      return cached;
    }

    const { data, error } = await client
      .from(GOALS_TABLE_NAME)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    const result = data ?? [];
    this.setCache(this.goalsCache, cacheKey, result);
    return result;
  }

  async createGoal(goalData: any) {
    const client = this.supabaseAdmin ?? this.supabase;
    if (!client) {
      throw new Error('Supabase no configurado');
    }

    const { data, error } = await client
      .from(GOALS_TABLE_NAME)
      .insert(goalData)
      .select()
      .single();
    
    if (error) throw error;
    if (goalData?.user_id) {
      this.invalidateUserDataCaches(goalData.user_id);
    }
    return data;
  }

  async updateGoal(goalId: string, userId: string, updateData: any) {
    const client = this.supabaseAdmin ?? this.supabase;
    if (!client) {
      throw new Error('Supabase no configurado');
    }

    try {
      const { data, error } = await client
        .from(GOALS_TABLE_NAME)
        .update(updateData)
        .eq('id', goalId)
        .eq('user_id', userId)
        .select()
        .single();
      
      if (error) {
        console.error('Error actualizando meta en Supabase:', {
          goalId,
          userId,
          updateData,
          updateDataTypes: Object.keys(updateData).reduce((acc, key) => {
            acc[key] = typeof updateData[key];
            return acc;
          }, {} as Record<string, string>),
          error: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw new Error(`Error al actualizar meta: ${error.message}`);
      }
      
      this.invalidateUserDataCaches(userId);
      return data;
    } catch (error) {
      console.error('Error en updateGoal:', error);
      throw error;
    }
  }

  async deleteGoal(goalId: string, userId: string) {
    const client = this.supabaseAdmin ?? this.supabase;
    if (!client) {
      throw new Error('Supabase no configurado');
    }

    const { error } = await client
      .from(GOALS_TABLE_NAME)
      .delete()
      .eq('id', goalId)
      .eq('user_id', userId);
    
    if (error) throw error;
    this.invalidateUserDataCaches(userId);
    return { success: true };
  }

  private get investmentSelectFields() {
    return `
      id,
      user_id,
      amount,
      term,
      interest_rate,
      maturity_date,
      is_domiciliation,
      periodicity,
      periodicity_days,
      next_charge_date,
      charge_day,
      is_paused,
      is_cancelled,
      status,
      created_at,
      updated_at,
      old_system
    `;
  }

  private mapInvestmentRow(row: any): InvestmentRecord {
    const toBoolean = (value: unknown): boolean => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value === 1;
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', '1', 't', 'yes', 'si', 'sí'].includes(normalized)) return true;
        if (['false', '0', 'f', 'no', 'null', ''].includes(normalized)) return false;
      }
      return Boolean(value);
    };

    return {
      id: row.id,
      userId: row.user_id,
      amount: Number(row.amount ?? 0),
      term: Number(row.term ?? 0),
      interestRate: Number(row.interest_rate ?? 0),
      createdAt: row.created_at,
      maturityDate: row.maturity_date,
      isDomiciliation: toBoolean(row.is_domiciliation),
      oldSystem: toBoolean(row.old_system),
      periodicity: row.periodicity ?? null,
      periodicityDays: row.periodicity_days ?? null,
      nextChargeDate: row.next_charge_date ?? null,
      isPaused: toBoolean(row.is_paused),
      isCancelled: toBoolean(row.is_cancelled),
      chargeDay: row.charge_day ?? null,
      status: (row.status ?? 'active') as InvestmentStatus,
      updatedAt: row.updated_at ?? null,
    };
  }

  async applyDepositToUser(
    userId: string,
    amount: number,
    reference: string,
    description: string,
    branchId?: string,
    posUserId?: string,
  ): Promise<void> {
    const client = this.supabaseAdmin ?? this.supabase;
    if (!client) {
      return;
    }

    const { data: currentUser, error: fetchError } = await client
      .from('app_users')
      .select('available_balance, total_balance')
      .eq('id', userId)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    const currentBalance = Number(currentUser?.available_balance ?? 0);
    const currentTotal = Number(currentUser?.total_balance ?? currentBalance);
    const newBalance = currentBalance + Number(amount ?? 0);
    const newTotal = currentTotal + Number(amount ?? 0);
    const timestamp = new Date().toISOString();

    const { error: updateError } = await client
      .from('app_users')
      .update({
        available_balance: newBalance,
        total_balance: newTotal,
        last_balance_update: timestamp,
      })
      .eq('id', userId);

    if (updateError) {
      throw updateError;
    }

    const { error: transactionError } = await client
      .from('transactions')
      .insert({
        user_id: userId,
        branch_id: branchId ?? null,
        pos_user_id: posUserId ?? null,
        type: 'deposit',
        amount,
        description,
        reference,
        status: 'completed',
      });

    if (transactionError) {
      throw transactionError;
    }

    const { error: balanceTransactionError } = await client
      .from('balance_transactions')
      .insert({
        user_id: userId,
        type: 'deposit',
        amount,
        balance_before: currentBalance,
        balance_after: newBalance,
        reference,
        description,
      });

    if (balanceTransactionError) {
      throw balanceTransactionError;
    }

    this.invalidateUserDataCaches(userId);
  }

  async linkPosDepositsToUser(userId: string, phoneNumber: string): Promise<{ count: number; amounts: number[] }> {
    const client = this.supabaseAdmin ?? this.supabase;
    if (!client) {
      return { count: 0, amounts: [] };
    }

    const variants = this.buildPhoneVariants(phoneNumber);
    if (variants.length === 0) {
      return { count: 0, amounts: [] };
    }

    const { data: pendingDeposits, error: fetchError } = await client
      .from('pos_deposits')
      .select('id, amount, reference, status')
      .in('phone_number', variants)
      .is('app_user_id', null)
      .eq('status', 'completed');

    if (fetchError) {
      throw fetchError;
    }

    if (!pendingDeposits || pendingDeposits.length === 0) {
      return { count: 0, amounts: [] };
    }

    const linkedAmounts: number[] = [];
    for (const deposit of pendingDeposits) {
      const reference =
        deposit.reference ??
        `DEP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const { error: updateError } = await client
        .from('pos_deposits')
        .update({
          app_user_id: userId,
          reference,
        })
        .eq('id', deposit.id);

      if (updateError) {
        throw updateError;
      }

      await this.applyDepositToUser(
        userId,
        Number(deposit.amount ?? 0),
        reference,
        'Abono desde POS'
      );

      linkedAmounts.push(Number(deposit.amount ?? 0));
    }

    return { count: linkedAmounts.length, amounts: linkedAmounts };
  }
}
