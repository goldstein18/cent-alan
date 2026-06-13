import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InsuranceService } from './insurance.service';

@ApiTags('Insurance')
@Controller('insurance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InsuranceController {
  constructor(private readonly insuranceService: InsuranceService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Obtener planes de seguro disponibles' })
  async getPlans() {
    return this.insuranceService.getPlans();
  }

  @Post('contract')
  @ApiOperation({ summary: 'Contratar seguro' })
  async contractInsurance(@Request() req: any, @Body() contractData: any) {
    return this.insuranceService.contractInsurance(req.user.id, contractData);
  }

  @Get('contracts')
  @ApiOperation({ summary: 'Obtener seguros contratados' })
  async getContracts(@Request() req: any) {
    return this.insuranceService.getContracts(req.user.id);
  }

  @Post('contracts/:id/cancel')
  @ApiOperation({ summary: 'Cancelar contrato de seguro' })
  async cancelContract(@Request() req: any, @Param('id') contractId: string) {
    return this.insuranceService.cancelContract(req.user.id, contractId);
  }
}
