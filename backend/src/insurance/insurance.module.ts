import { Module } from '@nestjs/common';
import { BalanceModule } from '../balance/balance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { InsuranceController } from './insurance.controller';
import { InsuranceService } from './insurance.service';

@Module({
  imports: [SupabaseModule, BalanceModule, NotificationsModule],
  controllers: [InsuranceController],
  providers: [InsuranceService],
  exports: [InsuranceService],
})
export class InsuranceModule {}
