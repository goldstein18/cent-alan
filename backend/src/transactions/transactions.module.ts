import { Module } from '@nestjs/common';
import { BalanceModule } from '../balance/balance.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [SupabaseModule, BalanceModule, NotificationsModule, ReferralsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
