import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FinanceService } from './finance.service';

@ApiTags('Finance (Finanzas Personales)')
@Controller('finance')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Obtener resumen financiero del usuario' })
  async getFinanceSummary(@Request() req: any) {
    return this.financeService.getFinanceSummary(req.user.id);
  }

  @Get('expense-categories')
  @ApiOperation({ summary: 'Obtener análisis de gastos por categoría' })
  async getExpenseCategories(
    @Request() req: any,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    return this.financeService.getExpenseCategories(req.user.id, startDate, endDate);
  }

  @Get('monthly-analysis')
  @ApiOperation({ summary: 'Obtener análisis mensual de ingresos y gastos' })
  async getMonthlyAnalysis(
    @Request() req: any,
    @Query('months') months?: number
  ) {
    const monthsCount = months ? Number(months) : 6;
    return this.financeService.getMonthlyAnalysis(req.user.id, monthsCount);
  }

  @Get('projections')
  @ApiOperation({ summary: 'Obtener proyecciones financieras futuras' })
  async getFinancialProjections(
    @Request() req: any,
    @Query('months') months?: number
  ) {
    const monthsCount = months ? Number(months) : 6;
    return this.financeService.getFinancialProjections(req.user.id, monthsCount);
  }

  @Get('recommendations')
  @ApiOperation({ summary: 'Obtener recomendaciones financieras personalizadas' })
  async getFinancialRecommendations(@Request() req: any) {
    return this.financeService.getFinancialRecommendations(req.user.id);
  }
}


