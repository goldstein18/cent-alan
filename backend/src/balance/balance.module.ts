import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';

@Module({
  imports: [SupabaseModule, NotificationsModule],
  controllers: [BalanceController],
  providers: [BalanceService],
  exports: [BalanceService],
})
export class BalanceModule {}
