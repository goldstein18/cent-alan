import { Module } from '@nestjs/common';
import { BalanceModule } from '../balance/balance.module';
import { InvestmentRatesModule } from '../investment-rates/investment-rates.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

@Module({
  imports: [SupabaseModule, BalanceModule, NotificationsModule, InvestmentRatesModule],
  controllers: [GoalsController],
  providers: [GoalsService],
  exports: [GoalsService],
})
export class GoalsModule {}
