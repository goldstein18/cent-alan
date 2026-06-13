import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { SupabaseService } from '../../supabase/supabase.service';

interface AdminJwtPayload {
  sub: string;
  email: string;
  role?: string;
}

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: AdminJwtPayload) {
    if (!payload?.sub || payload.role !== 'admin') {
      throw new UnauthorizedException('Token de administrador inválido');
    }

    const admin = await this.supabaseService.getAdminUserById(payload.sub);

    if (!admin || admin.is_active === false) {
      throw new UnauthorizedException('Administrador no encontrado o inactivo');
    }

    return {
      id: admin.id,
      email: admin.email,
      role: admin.role ?? 'admin',
    };
  }
}

