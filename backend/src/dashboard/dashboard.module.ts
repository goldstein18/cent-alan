import { Module } from '@nestjs/common';
import { BalanceModule } from '../balance/balance.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [SupabaseModule, BalanceModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
