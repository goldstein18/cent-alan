import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin/admin.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AuthModule } from './auth/auth.module';
import { BalanceModule } from './balance/balance.module';
import { BeneficiariesModule } from './beneficiaries/beneficiaries.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FinanceModule } from './finance/finance.module';
import { GoalsModule } from './goals/goals.module';
import { HealthModule } from './health/health.module';
import { InsuranceModule } from './insurance/insurance.module';
import { InvestmentRatesModule } from './investment-rates/investment-rates.module';
import { InvestmentsModule } from './investments/investments.module';
import { MtCenterModule } from './mt-center/mt-center.module';
import { PaymentsModule } from './payments/payments.module';
import { PosModule } from './pos/pos.module';
import { ReferralsModule } from './referrals/referrals.module';
import { SplitRequestsModule } from './split-requests/split-requests.module';
import { SupabaseModule } from './supabase/supabase.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    NotificationsModule,
    HealthModule,
    SupabaseModule,
    BeneficiariesModule,
    AdminModule,
    AuthModule,
    BalanceModule,
    DashboardModule,
    FinanceModule,
    UsersModule,
    TransactionsModule,
    InvestmentsModule,
    GoalsModule,
    InvestmentRatesModule,
    ReferralsModule,
    SplitRequestsModule,
    InsuranceModule,
    PosModule,
    PaymentsModule,
    MtCenterModule,
  ],
})
export class AppModule {}
