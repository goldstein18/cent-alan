import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InvestmentRatesService } from './investment-rates.service';
import { CreateInvestmentRateDto } from '../types/investment-rate';

@ApiTags('Investment Rates')
@Controller('investment-rates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvestmentRatesController {
  constructor(private readonly investmentRatesService: InvestmentRatesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener tasas de inversión configuradas' })
  async getRates() {
    return this.investmentRatesService.getRates();
  }

  @Post()
  @ApiOperation({ summary: 'Actualizar o crear una tasa de inversión' })
  async upsertRate(@Body() body: CreateInvestmentRateDto) {
    return this.investmentRatesService.upsertRate(body);
  }
}

