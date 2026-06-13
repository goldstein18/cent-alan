import { Module } from '@nestjs/common';
import { BalanceModule } from '../balance/balance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { SplitRequestsController } from './split-requests.controller';
import { SplitRequestsService } from './split-requests.service';

@Module({
  imports: [SupabaseModule, BalanceModule, NotificationsModule],
  controllers: [SplitRequestsController],
  providers: [SplitRequestsService],
  exports: [SplitRequestsService],
})
export class SplitRequestsModule {}
