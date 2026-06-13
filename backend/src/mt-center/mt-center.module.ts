import { Module } from '@nestjs/common';
import { BalanceModule } from '../balance/balance.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { MtCenterController } from './mt-center.controller';
import { MtCenterService } from './mt-center.service';

@Module({
  imports: [SupabaseModule, BalanceModule],
  controllers: [MtCenterController],
  providers: [MtCenterService],
  exports: [MtCenterService],
})
export class MtCenterModule {}

