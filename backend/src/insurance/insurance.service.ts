import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import { BalanceService } from '../balance/balance.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class InsuranceService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly balanceService: BalanceService,
    private readonly notificationsService: NotificationsService,
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

  async getPlans() {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new BadRequestException('Supabase no configurado');
    }

    try {
      const { data, error } = await client
        .from('insurance_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) {
        throw new BadRequestException(`Error al obtener planes de seguro: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((plan: any) => ({
        id: plan.code,
        name: plan.name,
        description: plan.description,
        coverage: Array.isArray(plan.coverage_details) ? plan.coverage_details : [],
        benefits: Array.isArray(plan.benefits) ? plan.benefits : [],
        monthlyPremium: Number(plan.monthly_premium),
        annualPremium: Number(plan.annual_premium),
        isActive: plan.is_active,
      }));
    } catch (error: any) {
      throw new BadRequestException(
        `Error al obtener planes de seguro: ${error?.message ?? 'Error desconocido'}`,
      );
    }
  }

  async contractInsurance(userId: string, contractData: any) {

    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new BadRequestException('Supabase no configurado');
    }

    // Verificar PIN
    if (!contractData.pin) {
      throw new UnauthorizedException('PIN requerido');
    }
    const isValidPin = await this.verifyPin(userId, contractData.pin);
    if (!isValidPin) {
      throw new UnauthorizedException('PIN incorrecto');
    }
    

    // Validar que no se pueda contratar más de un seguro para sí mismo
    if (contractData.beneficiary === 'para-mi') {
      const { data: existingContracts, error: checkError } = await client
        .from('insurance_contracts')
        .select('id, status, beneficiary_type')
        .eq('user_id', userId)
        .neq('beneficiary_type', 'tercero')
        .eq('status', 'active'); // Solo verificar contratos activos

      if (checkError) {
        console.error('Error checking existing contracts:', checkError);
        // Continuar con la creación si hay error en la consulta, pero loguearlo
      } else if (existingContracts && existingContracts.length > 0) {
        throw new BadRequestException(
          'Ya tienes un seguro activo contratado para ti mismo. Solo puedes tener un seguro a la vez. Si deseas contratar otro, primero cancela el seguro actual.'
        );
      }
    }

    try {
      // Calcular fechas
      const startDate = new Date();
      const endDate = new Date();
      if (contractData.planType === 'mensual') {
        endDate.setMonth(endDate.getMonth() + 1);
      } else {
        endDate.setFullYear(endDate.getFullYear() + 1);
      }

      // Calcular premium
      const monthlyPremium = contractData.planType === 'mensual' ? 116 : 1160; // Mensual: 116, Anual: 1160
      const coverageAmount = 100000; // Monto de cobertura por defecto


      // Generar número de contrato
      const contractNumber = `CENT-${Date.now().toString().slice(-8)}`;

      const ownerUser = await this.supabaseService.getUser(userId);
      const ownerName = ownerUser ? `${ownerUser.first_name} ${ownerUser.last_name}`.trim() : '';
      const ownerPhone = ownerUser?.phone_number ?? '';

      // Intentar vincular beneficiario por teléfono o email.
      // Si viene teléfono, usar solo dígitos para evitar que Supabase intente compararlo como UUID.
      let beneficiaryIdentifier = '';
      if (contractData.phone) {
        const phoneDigits = (contractData.phone || '').replace(/\D/g, '');
        beneficiaryIdentifier = phoneDigits;
      } else if (contractData.email) {
        beneficiaryIdentifier = contractData.email.trim();
      }

      const beneficiaryUser = beneficiaryIdentifier
        ? await this.supabaseService.getUser(beneficiaryIdentifier)
        : null;
      const beneficiaryUserId = beneficiaryUser?.id ?? null;

      // Preparar beneficiarios
      const beneficiaries = contractData.beneficiary === 'para-mi' 
        ? [{
            name: `${contractData.firstName} ${contractData.paternalLastName} ${contractData.maternalLastName}`,
            phone: contractData.phone,
            email: contractData.email,
            birthDate: contractData.birthDate,
            rfc: contractData.rfc,
            curp: contractData.curp,
            gender: contractData.gender,
          }]
        : [{
            name: `${contractData.firstName} ${contractData.paternalLastName} ${contractData.maternalLastName}`,
            phone: contractData.phone,
            email: contractData.email,
            birthDate: contractData.birthDate,
            rfc: contractData.rfc,
            curp: contractData.curp,
            gender: contractData.gender,
          }];

      // Calcular próxima fecha de pago
      const nextPaymentDate = new Date(startDate);
      if (contractData.planType === 'mensual') {
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
      } else {
        nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
      }

      const { data, error } = await client
        .from('insurance_contracts')
        .insert({
          user_id: userId,
          plan_id: 'cientplus',
          plan_name: 'Plan CiENTe+',
          plan_type: 'health',
          coverage_amount: coverageAmount,
          monthly_premium: monthlyPremium,
          contract_number: contractNumber,
          policy_number: contractNumber,
          insurance_company: 'CENT Seguros',
          coverage_type: contractData.beneficiary === 'para-mi' ? 'individual' : 'family',
          status: 'active',
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          renewal_date: endDate.toISOString().split('T')[0],
          payment_frequency: contractData.planType === 'mensual' ? 'monthly' : 'yearly',
          next_payment_date: nextPaymentDate.toISOString().split('T')[0],
          beneficiaries: beneficiaries,
          beneficiary_user_id: beneficiaryUserId,
          owner_name: ownerName,
          owner_phone: ownerPhone,
          beneficiary_type: contractData.beneficiary,
        })
        .select('*')
        .single();

      if (error) {
        console.error('Error creating insurance contract in database:', error);
        throw new BadRequestException(`Error al crear el contrato: ${error.message}`);
      }


      // Validar balance disponible antes de deducir
      const availableBalance = await this.balanceService.getAvailableBalance(userId);
      if (availableBalance.availableBalance < monthlyPremium) {
        // Si falla la validación de balance, cancelar el contrato creado
        await client
          .from('insurance_contracts')
          .update({ status: 'cancelled' })
          .eq('id', data.id);
        throw new BadRequestException(
          `Saldo insuficiente. Disponible: $${availableBalance.availableBalance.toFixed(2)}, Requerido: $${monthlyPremium.toFixed(2)}`
        );
      }

      // Deducir el balance (el cálculo dinámico ahora incluye seguros desde insurance_contracts)
      const reference = `INS-${contractNumber}`;
      try {
        await this.balanceService.deductBalance(
          userId,
          monthlyPremium,
          reference,
          `Contratación de seguro: ${data.plan_name} (${contractData.planType === 'mensual' ? 'Mensual' : 'Anual'})`,
          true
        );
      } catch (balanceError) {
        console.error('Error deducting balance for insurance contract:', {
          contractId: data.id,
          userId,
          amount: monthlyPremium,
          error: balanceError instanceof Error ? balanceError.message : 'Error desconocido',
          stack: balanceError instanceof Error ? balanceError.stack : undefined,
        });
        // Si falla la deducción, cancelar el contrato creado para mantener consistencia
        await client
          .from('insurance_contracts')
          .update({ status: 'cancelled' })
          .eq('id', data.id);
        throw new BadRequestException(
          `Error al deducir el balance: ${balanceError instanceof Error ? balanceError.message : 'Error desconocido'}`
        );
      }

      return {
        id: data.id,
        planId: data.plan_id ?? 'cientplus',
        planName: data.plan_name,
        beneficiaryName: beneficiaries[0].name,
        beneficiaryPhone: beneficiaries[0].phone,
        contractDate: data.start_date,
        planType: data.payment_frequency === 'monthly' ? 'mensual' : 'anual',
        status: data.status,
        created_at: data.created_at,
        userId: data.user_id,
        beneficiaryUserId: data.beneficiary_user_id,
        ownerName: data.owner_name,
        ownerPhone: data.owner_phone,
        beneficiaryType: data.beneficiary_type,
        isBeneficiary: Boolean(false),
      };
    } catch (error) {
      console.error('Error creating insurance contract:', error);
      throw error;
    }

    // Notificar activación de CiENTe+ (fire-and-forget, errors handled internally)
    this.notificationsService.notifyInsuranceActivated(userId);
  }

  /**
   * Procesa pagos recurrentes de seguros mensuales
   * Si hay pagos pendientes (next_payment_date <= hoy), intenta deducir el balance
   * Si no hay suficiente balance, cancela el seguro automáticamente
   */
  private async processRecurringPayments(userId: string): Promise<void> {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      return;
    }

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      // Buscar contratos activos mensuales con pagos pendientes
      const { data: pendingContracts, error: fetchError } = await client
        .from('insurance_contracts')
        .select('id, user_id, monthly_premium, payment_frequency, next_payment_date, contract_number, plan_name')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('payment_frequency', 'monthly')
        .lte('next_payment_date', todayStr);

      if (fetchError) {
        console.error('Error fetching pending insurance payments:', fetchError);
        return;
      }

      if (!pendingContracts || pendingContracts.length === 0) {
        return; // No hay pagos pendientes
      }

      // Procesar cada contrato pendiente
      for (const contract of pendingContracts) {
        const premium = Number(contract.monthly_premium || 0);
        if (premium <= 0) continue;

        try {
          // Validar balance disponible
          const availableBalance = await this.balanceService.getAvailableBalance(userId);
          
          if (availableBalance.availableBalance < premium) {
            // No hay suficiente balance, cancelar el seguro
            await client
              .from('insurance_contracts')
              .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', contract.id);
            continue;
          }

          // Hay suficiente balance, procesar el pago
          const reference = `INS-RENEWAL-${contract.contract_number || contract.id}`;
          await this.balanceService.deductBalance(
            userId,
            premium,
            reference,
            `Renovación mensual de seguro: ${contract.plan_name}`,
            true
          );

          // Calcular nueva fecha de pago (próximo mes)
          const nextPaymentDate = new Date(contract.next_payment_date || today);
          nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
          
          // Calcular nueva fecha de fin (extender un mes)
          const currentEndDate = new Date(contract.next_payment_date || today);
          currentEndDate.setMonth(currentEndDate.getMonth() + 1);

          // Actualizar contrato con nueva fecha de pago y último pago
          await client
            .from('insurance_contracts')
            .update({
              next_payment_date: nextPaymentDate.toISOString().split('T')[0],
              last_payment_date: today.toISOString().split('T')[0],
              last_payment_amount: premium,
              end_date: currentEndDate.toISOString().split('T')[0],
              updated_at: new Date().toISOString(),
            })
            .eq('id', contract.id);

        } catch (paymentError) {
          console.error(`Error processing payment for contract ${contract.id}:`, paymentError);
          // Si falla el pago, cancelar el seguro
          try {
            await client
              .from('insurance_contracts')
              .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq('id', contract.id);
          } catch (cancelError) {
            console.error(`Error cancelling contract ${contract.id} after payment failure:`, cancelError);
          }
        }
      }
    } catch (error) {
      console.error('Error in processRecurringPayments:', error);
      // No lanzar error para no interrumpir el flujo principal
    }
  }

  async getContracts(userId: string) {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new BadRequestException('Supabase no configurado');
    }

    // Procesar pagos recurrentes antes de obtener los contratos
    await this.processRecurringPayments(userId);

    try {
      const { data, error } = await client
        .from('insurance_contracts')
        .select('*, individual_policy_number')
        .or(`user_id.eq.${userId},beneficiary_user_id.eq.${userId}`)
        .order('created_at', { ascending: false });

      if (error) {
        throw new BadRequestException(`Error al obtener contratos: ${error.message}`);
      }

      return (data || []).map((contract: any) => {
        const beneficiaries = contract.beneficiaries || [];
        const firstBeneficiary = beneficiaries[0] || {};
        
        // Construir número de póliza completo: "70865-00 - [individual]" o solo "70865-00" si no hay individual
        const basePolicyNumber = '70865-00';
        const individualPolicyNumber = contract.individual_policy_number || null;
        const fullPolicyNumber = individualPolicyNumber 
          ? `${basePolicyNumber} - ${individualPolicyNumber}` 
          : basePolicyNumber;
        
        // Log para debugging
        
        return {
          id: contract.id,
          planId: contract.plan_id ?? 'cientplus',
          planName: contract.plan_name,
          beneficiaryName: firstBeneficiary.name || 'Beneficiario',
          beneficiaryPhone: firstBeneficiary.phone || '',
          contractDate: contract.start_date,
          planType: contract.payment_frequency === 'monthly' ? 'mensual' : 'anual',
          status: contract.status,
          created_at: contract.created_at,
          updated_at: contract.updated_at,
          userId: contract.user_id,
          beneficiaryUserId: contract.beneficiary_user_id,
          ownerName: contract.owner_name,
          ownerPhone: contract.owner_phone,
          beneficiaryType: contract.beneficiary_type,
          isBeneficiary: Boolean(contract.beneficiary_user_id && contract.beneficiary_user_id !== contract.user_id),
          policyNumber: fullPolicyNumber,
          individualPolicyNumber: individualPolicyNumber,
          endDate: contract.end_date,
        };
      });
    } catch (error) {
      console.error('Error fetching insurance contracts:', error);
      throw error;
    }
  }

  async cancelContract(userId: string, contractId: string) {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new BadRequestException('Supabase no configurado');
    }

    const { data: contract, error: fetchError } = await client
      .from('insurance_contracts')
      .select('id, user_id, beneficiary_user_id, status')
      .eq('id', contractId)
      .maybeSingle();

    if (fetchError || !contract) {
      throw new BadRequestException('Contrato no encontrado');
    }

    // Solo permitir que el titular o el beneficiario asociado lo cancelen
    if (contract.user_id !== userId && contract.beneficiary_user_id !== userId) {
      throw new BadRequestException('No autorizado para cancelar este contrato');
    }

    // Si ya está cancelado, regresar el estado actual
    if (contract.status?.toLowerCase() === 'cancelled' || contract.status?.toLowerCase() === 'cancelado') {
      return { id: contractId, status: contract.status };
    }

    const { error: updateError } = await client
      .from('insurance_contracts')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', contractId);

    if (updateError) {
      throw new BadRequestException(`Error al cancelar contrato: ${updateError.message}`);
    }

    return { id: contractId, status: 'cancelled' };
  }
}
