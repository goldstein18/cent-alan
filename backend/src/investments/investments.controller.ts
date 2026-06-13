import { Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateDomiciliationDto, CreateInvestmentDto, DomiciliationManagementDto } from '../types/investment';
import { InvestmentsService } from './investments.service';

@ApiTags('Investments')
@Controller('investments')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvestmentsController {
  constructor(private readonly investmentsService: InvestmentsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener inversiones del usuario' })
  async getInvestments(@Request() req: any) {
    return this.investmentsService.getInvestments(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear nueva inversión' })
  async createInvestment(@Request() req: any, @Body() createInvestmentDto: CreateInvestmentDto) {
    return this.investmentsService.createInvestment(req.user.id, createInvestmentDto);
  }

  @Post('domiciliation')
  @ApiOperation({ summary: 'Crear domiciliación automática' })
  async createDomiciliation(@Request() req: any, @Body() createDomiciliationDto: CreateDomiciliationDto) {
    return this.investmentsService.createDomiciliation(req.user.id, createDomiciliationDto);
  }

  @Put(':id/management')
  @ApiOperation({ summary: 'Gestionar domiciliación' })
  async manageDomiciliation(
    @Request() req: any,
    @Param('id') id: string,
    @Body() managementDto: DomiciliationManagementDto
  ) {
    return this.investmentsService.manageDomiciliation(req.user.id, id, managementDto);
  }

  @Post('calculations')
  @ApiOperation({ summary: 'Calcular rendimientos de inversión' })
  async calculateInvestment(@Body() body: { amount: number; term: number }) {
    return this.investmentsService.calculateInvestment(body.amount, body.term);
  }
}
