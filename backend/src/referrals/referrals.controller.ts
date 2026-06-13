import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReferralsService } from './referrals.service';

@ApiTags('Referrals')
@Controller('referrals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get()
  @ApiOperation({ summary: 'Resumen de referidos: código, estadísticas y lista de invitados' })
  async getReferrals(@Request() req: any) {
    return this.referralsService.getReferrals(req.user.id);
  }

  @Get('code')
  @ApiOperation({ summary: 'Obtener mi código de referido y enlace de invitación' })
  async getMyCode(@Request() req: any) {
    return this.referralsService.getMyCode(req.user.id);
  }

  @Get('commissions')
  @ApiOperation({ summary: 'Comisiones ganadas por referidos' })
  async getCommissions(@Request() req: any) {
    return this.referralsService.getCommissions(req.user.id);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validar un código de referido antes del signup' })
  async validateReferralCode(@Body() body: { referralCode: string }) {
    return this.referralsService.validateReferralCode(body.referralCode);
  }
}
