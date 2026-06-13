import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChangePasswordDto, ChangePinDto, UpdateUserDto } from '../types/user';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Obtener perfil del usuario' })
  async getProfile(@Request() req: any) {
    return this.usersService.getProfile(req.user.id);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Actualizar perfil del usuario' })
  async updateProfile(@Request() req: any, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.updateProfile(req.user.id, updateUserDto);
  }

  @Put('change-pin')
  @ApiOperation({ summary: 'Cambiar PIN de seguridad' })
  async changePin(@Request() req: any, @Body() changePinDto: ChangePinDto) {
    return this.usersService.changePin(req.user.id, changePinDto);
  }

  @Put('change-password')
  @ApiOperation({ summary: 'Cambiar contraseña de acceso' })
  async changePassword(@Request() req: any, @Body() changePasswordDto: ChangePasswordDto) {
    return this.usersService.changePassword(req.user.id, changePasswordDto);
  }

  @Get('referral-code')
  @ApiOperation({ summary: 'Obtener código de referido' })
  async getReferralCode(@Request() req: any) {
    return this.usersService.getReferralCode(req.user.id);
  }

  @Put('streak')
  @ApiOperation({ summary: 'Actualizar racha del usuario (se llama cuando abre la app)' })
  async updateStreak(@Request() req: any) {
    return this.usersService.updateStreak(req.user.id);
  }

  @Get('streak')
  @ApiOperation({ summary: 'Obtener racha actual del usuario' })
  async getStreak(@Request() req: any) {
    return this.usersService.getStreak(req.user.id);
  }

  @Get('clabe')
  @ApiOperation({ summary: 'Obtener CLABE del usuario' })
  async getClabe(@Request() req: any) {
    return this.usersService.getClabe(req.user.id);
  }
}
