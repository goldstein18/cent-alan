export interface CreateSplitRequestDto {
  concepto: string;
  descripcion?: string;
  participantes: Array<{
    nombre: string;
    telefono: string;
    monto: string | number;
  }>;
}

export interface SplitRequestParticipant {
  id: string;
  split_request_id: string;
  user_id?: string;
  phone_number: string;
  name: string;
  amount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'paid';
  created_at: string;
  updated_at?: string;
}

export interface SplitRequest {
  id: string;
  creator_user_id: string;
  concepto: string;
  descripcion?: string;
  total_amount: number;
  status: 'pending' | 'cancelled' | 'completed';
  created_at: string;
  updated_at?: string;
  participantes?: SplitRequestParticipant[];
}

export interface AcceptSplitRequestDto {
  pin: string;
}

export interface RejectSplitRequestDto {
  pin?: string;
}
