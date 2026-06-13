import { Body, Controller, Delete, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BeneficiariesService } from './beneficiaries.service';
import { CreateBeneficiaryDto } from '../types/beneficiary';

@ApiTags('Beneficiaries')
@Controller('beneficiaries')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener los beneficiarios registrados' })
  async getBeneficiaries(@Request() req: any) {
    return this.beneficiariesService.getBeneficiaries(req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Agregar un beneficiario general' })
  async createBeneficiary(@Request() req: any, @Body() createDto: CreateBeneficiaryDto) {
    return this.beneficiariesService.createBeneficiary(req.user.id, createDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar beneficiario general' })
  async deleteBeneficiary(@Request() req: any, @Param('id') id: string) {
    return this.beneficiariesService.deleteBeneficiary(req.user.id, id);
  }
}

