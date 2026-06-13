import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BalanceModule } from '../balance/balance.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { PaymentsController } from './payments.controller';
import { OpenPayService } from './openpay.service';
import { PaymentOtpService } from './payment-otp.service';

@Module({
  imports: [ConfigModule, SupabaseModule, BalanceModule],
  controllers: [PaymentsController],
  providers: [PaymentOtpService, OpenPayService],
  exports: [PaymentOtpService, OpenPayService],
})
export class PaymentsModule {}

