import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthModule } from '../auth/auth.module';
import { BalanceModule } from '../balance/balance.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { InvestmentRatesModule } from '../investment-rates/investment-rates.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminJwtStrategy } from '../auth/strategies/admin-jwt.strategy';

@Module({
  imports: [
    PassportModule,
    SupabaseModule,
    AuthModule,
    BalanceModule,
    InvestmentRatesModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '24h')
        },
      }),
    }),
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminJwtStrategy],
  exports: [AdminService],
})
export class AdminModule {}
