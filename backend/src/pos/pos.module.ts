import { Module } from '@nestjs/common';
import { BalanceModule } from '../balance/balance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { PosController } from './pos.controller';
import { PosService } from './pos.service';

@Module({
  imports: [SupabaseModule, BalanceModule, PaymentsModule, NotificationsModule, ReferralsModule],
  controllers: [PosController],
  providers: [PosService],
  exports: [PosService],
})
export class PosModule {}
