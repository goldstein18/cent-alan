import { BadRequestException, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateBeneficiaryDto, BeneficiaryModel } from '../types/beneficiary';

const BENEFICIARIES_TABLE = 'beneficiaries';

@Injectable()
export class BeneficiariesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private map(row: any): BeneficiaryModel {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      phone: row.phone,
      email: row.email ?? '',
      relationship: row.relationship ?? 'general',
      isPrimary: Boolean(row.is_primary),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getBeneficiaries(userId: string): Promise<BeneficiaryModel[]> {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new BadRequestException('Supabase no configurado');
    }

    const { data, error } = await client
      .from(BENEFICIARIES_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new BadRequestException(`Error al obtener beneficiarios: ${error.message}`);
    }

    return (data || []).map(row => this.map(row));
  }

  async createBeneficiary(userId: string, payload: CreateBeneficiaryDto): Promise<BeneficiaryModel> {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new BadRequestException('Supabase no configurado');
    }

    const { data: existing } = await client
      .from(BENEFICIARIES_TABLE)
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (existing && existing.length > 0) {
      throw new BadRequestException('Ya tienes un beneficiario registrado. Elimina el actual antes de agregar uno nuevo.');
    }

    const { data, error } = await client
      .from(BENEFICIARIES_TABLE)
      .insert({
        user_id: userId,
        name: payload.name,
        phone: payload.phone,
        email: payload.email ?? null,
        relationship: payload.relationship ?? 'general',
        is_primary: payload.isPrimary ?? true,
      })
      .select('*')
      .single();

    if (error) {
      throw new BadRequestException(`Error al crear beneficiario: ${error.message}`);
    }

    return this.map(data);
  }

  async deleteBeneficiary(userId: string, beneficiaryId: string): Promise<void> {
    const client = this.supabaseService.getAdminClient();
    if (!client) {
      throw new BadRequestException('Supabase no configurado');
    }

    const { error } = await client
      .from(BENEFICIARIES_TABLE)
      .delete()
      .eq('id', beneficiaryId)
      .eq('user_id', userId);

    if (error) {
      throw new BadRequestException(`Error al eliminar beneficiario: ${error.message}`);
    }
  }
}

