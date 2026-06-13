import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [SupabaseModule, NotificationsModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
