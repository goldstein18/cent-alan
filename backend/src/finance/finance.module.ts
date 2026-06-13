import { Module } from '@nestjs/common';
import { BalanceModule } from '../balance/balance.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';

@Module({
  imports: [SupabaseModule, BalanceModule],
  controllers: [FinanceController],
  providers: [FinanceService],
  exports: [FinanceService],
})
export class FinanceModule {}


