import { Module } from '@nestjs/common';
import { BalanceModule } from '../balance/balance.module';
import { InvestmentRatesModule } from '../investment-rates/investment-rates.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { InvestmentsController } from './investments.controller';
import { InvestmentsService } from './investments.service';

@Module({
  imports: [SupabaseModule, BalanceModule, InvestmentRatesModule, NotificationsModule],
  controllers: [InvestmentsController],
  providers: [InvestmentsService],
  exports: [InvestmentsService],
})
export class InvestmentsModule {}
