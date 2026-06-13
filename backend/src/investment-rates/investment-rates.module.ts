import { Module } from '@nestjs/common';
import { InvestmentRatesController } from './investment-rates.controller';
import { InvestmentRatesService } from './investment-rates.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [InvestmentRatesController],
  providers: [InvestmentRatesService],
  exports: [InvestmentRatesService],
})
export class InvestmentRatesModule {}

