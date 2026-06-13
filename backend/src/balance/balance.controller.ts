import { Controller, Get, HttpException, HttpStatus, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BalanceService } from './balance.service';

@ApiTags('Balance')
@Controller('balance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener balance del usuario' })
  async getUserBalance(@Request() req) {
    return this.balanceService.getUserBalance(req.user.id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Obtener historial de balance' })
  async getBalanceHistory(@Request() req) {
    return this.balanceService.getBalanceHistory(req.user.id);
  }

  @Post('update')
  @ApiOperation({ summary: 'Actualizar balance del usuario' })
  async updateBalance(@Request() req) {
    return this.balanceService.updateUserBalance(req.user.id);
  }

  @Get('available')
  @ApiOperation({ summary: 'Obtener saldo disponible calculado' })
  async getAvailableBalance(@Request() req) {
    try {
      return await this.balanceService.getAvailableBalance(req.user.id);
    } catch (error) {
      console.error('Error in getAvailableBalance controller:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Error al calcular el saldo disponible',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('total')
  @ApiOperation({ summary: 'Obtener dinero total calculado' })
  async getTotalBalance(@Request() req) {
    try {
      return await this.balanceService.getTotalBalance(req.user.id);
    } catch (error) {
      console.error('Error in getTotalBalance controller:', error);
      throw new HttpException(
        error instanceof Error ? error.message : 'Error al calcular el dinero total',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
