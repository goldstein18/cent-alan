import { Body, Controller, Delete, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RegisterTokenDto } from './dto/register-token.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('push-token')
  @ApiOperation({ summary: 'Registrar o actualizar el push token del dispositivo' })
  async registerToken(@Request() req: any, @Body() dto: RegisterTokenDto) {
    await this.notificationsService.registerToken(req.user.id, dto.token, dto.platform);
    return { success: true, message: 'Push token registrado exitosamente' };
  }

  @Delete('push-token')
  @ApiOperation({ summary: 'Eliminar el push token del dispositivo (logout)' })
  async removeToken(@Request() req: any, @Body() dto: RegisterTokenDto) {
    await this.notificationsService.removeToken(req.user.id, dto.token);
    return { success: true, message: 'Push token eliminado' };
  }
}
