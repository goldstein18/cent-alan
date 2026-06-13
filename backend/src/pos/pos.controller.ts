import { BadRequestException, Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { PosService } from './pos.service';

@ApiTags('POS (Point of Sale)')
@Controller('pos')
export class PosController {
  constructor(private readonly posService: PosService) {}

  // ==================== REPORTES CSV (POS) ====================
  // IMPORTANTE: Estas rutas DEBEN estar PRIMERO para evitar conflictos de routing
  // Las rutas específicas con múltiples segmentos deben ir antes de rutas con parámetros
  
  @Get('reportes/csv')
  @ApiOperation({ summary: 'Reporte CSV con teléfonos (POS)' })
  async exportCsv(
    @Res() res: Response,
    @Query('sucursal') branchId?: string,
    @Query('marca') brandId?: string,
    @Query('fechaInicio') startDate?: string,
    @Query('fechaFin') endDate?: string,
  ) {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin');
    
    if (!branchId && !brandId) {
      throw new BadRequestException('Se requiere sucursal o marca para generar el reporte');
    }

    const csv = await this.posService.generateCsvReport({
      branchId,
      brandId,
      startDate,
      endDate,
      includePhone: true,
    });

    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-pos-con-telefono-${today}.csv"`);
    res.send('\uFEFF' + csv); // BOM for Excel
  }

  @Get('reportes/csv-sin-telefono')
  @ApiOperation({ summary: 'Reporte CSV sin teléfonos (POS)' })
  async exportCsvNoPhone(
    @Res() res: Response,
    @Query('sucursal') branchId?: string,
    @Query('marca') brandId?: string,
    @Query('fechaInicio') startDate?: string,
    @Query('fechaFin') endDate?: string,
  ) {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin');
    
    if (!branchId && !brandId) {
      throw new BadRequestException('Se requiere sucursal o marca para generar el reporte');
    }

    const csv = await this.posService.generateCsvReport({
      branchId,
      brandId,
      startDate,
      endDate,
      includePhone: false,
    });

    const today = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-pos-sin-telefono-${today}.csv"`);
    res.send('\uFEFF' + csv); // BOM for Excel
  }

  // Autenticación POS
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión en POS' })
  async loginPosUser(@Body() loginData: { email: string; password: string }) {
    return this.posService.loginPosUser(loginData.email, loginData.password);
  }

  // Sistema de abonos (funcionalidad principal del POS)
  @Post('abonos')
  @ApiOperation({ summary: 'Crear abono desde POS' })
  async createDeposit(@Body() depositData: any) {
    return this.posService.createDeposit(depositData);
  }

  @Get('abonos')
  @ApiOperation({ summary: 'Obtener abonos' })
  async getDeposits(
    @Query('posUserId') posUserId?: string,
    @Query('branchId') branchId?: string,
    @Query('limit') limit?: number
  ) {
    return this.posService.getDeposits(posUserId, branchId, limit);
  }

  @Get('abonos/:id')
  @ApiOperation({ summary: 'Obtener abono por ID' })
  async getDepositById(@Param('id') depositId: string) {
    return this.posService.getDepositById(depositId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Obtener estadísticas del POS' })
  async getPosStats(
    @Query('posUserId') posUserId: string,
    @Query('branchId') branchId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string
  ) {
    const dateRange = startDate && endDate ? { start: startDate, end: endDate } : undefined;
    return this.posService.getPosStats(posUserId, branchId, dateRange);
  }

  // Sistema de pagos con CENT (requiere OTP)
  @Post('pagos')
  @ApiOperation({ summary: 'Procesar pago con CENT desde POS' })
  async processPayment(@Body() paymentData: any) {
    return this.posService.processPayment(paymentData);
  }

  // Sistema de cancelación de transacciones
  @Post('cancelaciones/transacciones')
  @ApiOperation({ summary: 'Obtener transacciones recientes para cancelación' })
  async getRecentTransactions(@Body() body: { phone_number: string; phone_confirmation: string }) {
    return this.posService.getRecentTransactions(body.phone_number, body.phone_confirmation);
  }

  @Post('cancelaciones/cancelar')
  @ApiOperation({ summary: 'Cancelar una transacción (abono o pago)' })
  async cancelTransaction(@Body() cancelData: any) {
    return this.posService.cancelTransaction(cancelData);
  }
}
