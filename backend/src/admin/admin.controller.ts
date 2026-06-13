import { Body, Controller, Delete, ForbiddenException, Get, HttpException, InternalServerErrorException, Param, Post, Put, Query, Request, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { AdminJwtAuthGuard } from '../auth/guards/admin-jwt-auth.guard';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // Autenticación de administradores
  @Post('login')
  @ApiOperation({ summary: 'Login de administrador' })
  async loginAdmin(@Body() loginData: { email: string; password: string }) {
    return this.adminService.loginAdmin(loginData.email, loginData.password);
  }

  // Gestión de marcas
  @Post('brands')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear nueva marca' })
  async createBrand(@Body() brandData: { name: string; alias: string }) {
    return this.adminService.createBrand(brandData.name, brandData.alias);
  }

  @Get('brands')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener todas las marcas' })
  async getBrands() {
    return this.adminService.getBrands();
  }

  @Put('brands/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar marca' })
  async updateBrand(@Param('id') brandId: string, @Body() updateData: any) {
    return this.adminService.updateBrand(brandId, updateData);
  }

  @Delete('brands/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar marca' })
  async deleteBrand(@Param('id') brandId: string) {
    return this.adminService.deleteBrand(brandId);
  }

  // Gestión de sucursales
  @Post('branches')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear nueva sucursal' })
  async createBranch(@Body() branchData: {
    brand_id: string;
    name: string;
    alias: string;
    address_street?: string;
    address_number?: string;
    address_colony?: string;
    address_city?: string;
    address_state?: string;
    address_postal_code?: string;
    address_country?: string;
  }) {
    return this.adminService.createBranch(branchData.brand_id, branchData);
  }

  @Get('branches')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener sucursales' })
  async getBranches(@Query('brandId') brandId?: string) {
    return this.adminService.getBranches(brandId);
  }

  @Put('branches/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar sucursal' })
  async updateBranch(@Param('id') branchId: string, @Body() updateData: any) {
    return this.adminService.updateBranch(branchId, updateData);
  }

  @Delete('branches/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar sucursal' })
  async deleteBranch(@Param('id') branchId: string) {
    return this.adminService.deleteBranch(branchId);
  }

  // Gestión de usuarios POS
  @Post('pos-users')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear usuario POS' })
  async createPosUser(@Body() userData: {
    branch_id: string;
    full_name: string;
    email: string;
    password: string;
    role: 'cajero' | 'admin_caja' | 'gerente_sucursal' | 'admin_tienda' | 'operador_cent';
  }) {
    return this.adminService.createPosUser(userData.branch_id, userData);
  }

  @Get('pos-users')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener usuarios POS' })
  async getPosUsers(@Query('branchId') branchId?: string) {
    return this.adminService.getPosUsers(branchId);
  }

  @Put('pos-users/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar usuario POS' })
  async updatePosUser(@Param('id') userId: string, @Body() updateData: any) {
    return this.adminService.updatePosUser(userId, updateData);
  }

  @Delete('pos-users/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Eliminar usuario POS' })
  async deletePosUser(@Param('id') userId: string) {
    return this.adminService.deletePosUser(userId);
  }

  // ── Gestión de usuarios administradores ──────────────────────────────────

  @Post('admin-users')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear usuario administrador (solo master)' })
  async createAdminUser(
    @Request() req: any,
    @Body() body: { email: string; password: string; name: string; role?: string },
  ) {
    if (req.user?.role !== 'admin' && req.user?.role !== 'master' && req.user?.role !== 'super_admin') {
      throw new ForbiddenException('No tienes permisos para crear administradores');
    }
    return this.adminService.createAdminUser(body);
  }

  @Get('admin-users')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar usuarios administradores' })
  async getAdminUsers(@Request() req: any) {
    if (req.user?.role !== 'admin' && req.user?.role !== 'master' && req.user?.role !== 'super_admin') {
      throw new ForbiddenException('No tienes permisos para ver administradores');
    }
    return this.adminService.getAdminUsers();
  }

  @Put('admin-users/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar usuario administrador' })
  async updateAdminUser(
    @Request() req: any,
    @Param('id') adminId: string,
    @Body() updateData: { name?: string; role?: string; is_active?: boolean; password?: string },
  ) {
    if (req.user?.role !== 'admin' && req.user?.role !== 'master' && req.user?.role !== 'super_admin') {
      throw new ForbiddenException('No tienes permisos para modificar administradores');
    }
    return this.adminService.updateAdminUser(adminId, updateData);
  }

  @Delete('admin-users/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Desactivar usuario administrador' })
  async deleteAdminUser(@Request() req: any, @Param('id') adminId: string) {
    if (req.user?.role !== 'admin' && req.user?.role !== 'master' && req.user?.role !== 'super_admin') {
      throw new ForbiddenException('No tienes permisos para eliminar administradores');
    }
    return this.adminService.deleteAdminUser(adminId);
  }

  // ─────────────────────────────────────────────────────────────────────────

  @Get('transactions/external')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener transferencias externas' })
  async getExternalTransfers(
    @Query('userId') userId?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.adminService.getExternalTransfers({
      userId,
      status,
      startDate,
      endDate,
      search,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Put('transactions/external/:id/status')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar estado de transferencia externa' })
  async updateExternalTransferStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    if (req.user?.role !== 'admin' && req.user?.role !== 'master' && req.user?.role !== 'super_admin') {
      throw new ForbiddenException('No tienes permisos para aprobar transferencias externas');
    }

    return this.adminService.updateExternalTransferStatus(id, req.user.id, body);
  }

  // ========== GESTIÓN DE CLIENTES ==========

  @Get('customers')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar cliente por teléfono' })
  async findCustomerByPhone(@Query('phone') phone: string) {
    return this.adminService.findCustomerByPhone(phone);
  }

  @Get('customers/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener información completa del cliente' })
  async getCustomerById(@Param('id') id: string) {
    return this.adminService.getCustomerById(id);
  }

  @Put('customers/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar datos del cliente' })
  async updateCustomer(
    @Param('id') id: string,
    @Body() updateData: {
      name?: string;
      lastName?: string;
      dateOfBirth?: string;
      address?: string;
      city?: string;
      state?: string;
      zipCode?: string;
      email?: string;
      phone?: string;
      clabe?: string;
    }
  ) {
    return this.adminService.updateCustomer(id, updateData);
  }

  @Post('customers/:id/send-otp')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enviar código OTP al cliente' })
  async sendOtpToCustomer(
    @Param('id') id: string,
    @Body() body: { type?: 'email' | 'phone' | 'both' }
  ) {
    return this.adminService.sendOtpToCustomer(id, body.type || 'phone');
  }

  @Post('customers/:id/verify-otp')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verificar código OTP del cliente' })
  async verifyOtpForCustomer(
    @Param('id') id: string,
    @Body() body: { otp: string; purpose?: string; phoneNumber?: string }
  ) {
    return this.adminService.verifyOtpForCustomer(id, body.otp, body.purpose, body.phoneNumber);
  }

  // ========== ATENCIÓN A CLIENTES ==========

  @Get('customers/:id/info')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener información general del cliente' })
  async getCustomerInfo(@Param('id') id: string) {
    return this.adminService.getCustomerInfo(id);
  }

  @Get('customers/:id/balance')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener balance y saldos del cliente' })
  async getCustomerBalance(@Param('id') id: string) {
    return this.adminService.getCustomerBalance(id);
  }

  @Post('customers/:id/investments/:investmentId/credit-returns')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Acreditar rendimientos de una inversión vencida' })
  async creditInvestmentReturns(
    @Param('id') id: string,
    @Param('investmentId') investmentId: string,
  ) {
    return this.adminService.creditInvestmentReturns(id, investmentId);
  }

  @Get('customers/:id/investments')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener inversiones del cliente' })
  async getCustomerInvestments(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string
  ) {
    return this.adminService.getCustomerInvestments(id, { startDate, endDate, status });
  }

  @Get('customers/:id/purchases')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener historial de compras del cliente' })
  async getCustomerPurchases(
    @Param('id') id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('type') type?: string
  ) {
    return this.adminService.getCustomerPurchases(id, { startDate, endDate, type });
  }

  // ========== SEGUROS ==========

  @Get('insurance-requests')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener solicitudes de seguros' })
  async getInsuranceRequests(
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string
  ) {
    return this.adminService.getInsuranceRequests({
      status,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search
    });
  }

  @Get('insurance-requests/:id')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener detalles de una solicitud de seguro' })
  async getInsuranceRequestById(@Param('id') id: string) {
    return this.adminService.getInsuranceRequestById(id);
  }

  @Put('insurance-requests/:id/status')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar estado de solicitud de seguro' })
  async updateInsuranceRequestStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: {
      status: string;
      notes?: string;
      rejectedReason?: string;
      individualPolicyNumber?: string;
    }
  ) {
    return this.adminService.updateInsuranceRequestStatus(id, req.user.id, body);
  }

  // ========== TASAS DE INTERÉS ==========

  @Get('investment-rates')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener tasas de inversión configuradas' })
  async getInvestmentRates() {
    return this.adminService.getInvestmentRates();
  }

  @Post('investment-rates')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar o crear una tasa de inversión' })
  async upsertInvestmentRate(
    @Request() req: any,
    @Body() body: { 
      type: 'normal' | 'pro'; 
      interestRate: number;
      notes?: string;
    }
  ) {
    return this.adminService.upsertInvestmentRate(
      body, 
      req.user?.id, 
      body.notes
    );
  }

  // ==================== REPORTES CSV ====================
  // Rutas específicas primero (abonos/pagos/transferencias) antes de las legacy.

  @Get('reportes/csv/abonos')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reporte CSV de abonos con teléfonos' })
  async exportCsvAbonos(
    @Request() req: any,
    @Query('sucursal') branchId: string,
    @Query('fechaInicio') startDate: string,
    @Query('fechaFin') endDate: string,
    @Res() res: Response,
  ) {
    await this.sendAdminCsvReport(res, req, {
      report: 'abonos-con-telefono',
      filename: `reporte-abonos-con-telefono-${this.todayCsvFilenameDate()}.csv`,
      branchId,
      startDate,
      endDate,
      generator: () => this.adminService.generateAbonosCsvReport({
        branchId,
        startDate,
        endDate,
        includePhone: true,
      }),
    });
  }

  @Get('reportes/csv/pagos')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reporte CSV de pagos con teléfonos' })
  async exportCsvPagos(
    @Request() req: any,
    @Query('sucursal') branchId: string,
    @Query('fechaInicio') startDate: string,
    @Query('fechaFin') endDate: string,
    @Res() res: Response,
  ) {
    await this.sendAdminCsvReport(res, req, {
      report: 'pagos-con-telefono',
      filename: `reporte-pagos-con-telefono-${this.todayCsvFilenameDate()}.csv`,
      branchId,
      startDate,
      endDate,
      generator: () => this.adminService.generatePagosCsvReport({
        branchId,
        startDate,
        endDate,
        includePhone: true,
      }),
    });
  }

  @Get('reportes/csv/transferencias')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reporte CSV de transferencias externas con teléfono emisor' })
  async exportCsvTransferencias(
    @Request() req: any,
    @Query('fechaInicio') startDate: string,
    @Query('fechaFin') endDate: string,
    @Res() res: Response,
  ) {
    await this.sendAdminCsvReport(res, req, {
      report: 'transferencias-con-telefono',
      filename: `reporte-transferencias-con-telefono-${this.todayCsvFilenameDate()}.csv`,
      startDate,
      endDate,
      generator: () => this.adminService.generateTransferenciasCsvReport({
        startDate,
        endDate,
        includePhone: true,
      }),
    });
  }

  @Get('reportes/csv-sin-telefono/abonos')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reporte CSV de abonos sin teléfonos' })
  async exportCsvAbonosNoPhone(
    @Request() req: any,
    @Query('sucursal') branchId: string,
    @Query('fechaInicio') startDate: string,
    @Query('fechaFin') endDate: string,
    @Res() res: Response,
  ) {
    await this.sendAdminCsvReport(res, req, {
      report: 'abonos-sin-telefono',
      filename: `reporte-abonos-sin-telefono-${this.todayCsvFilenameDate()}.csv`,
      branchId,
      startDate,
      endDate,
      generator: () => this.adminService.generateAbonosCsvReport({
        branchId,
        startDate,
        endDate,
        includePhone: false,
      }),
    });
  }

  @Get('reportes/csv-sin-telefono/pagos')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reporte CSV de pagos sin teléfonos' })
  async exportCsvPagosNoPhone(
    @Request() req: any,
    @Query('sucursal') branchId: string,
    @Query('fechaInicio') startDate: string,
    @Query('fechaFin') endDate: string,
    @Res() res: Response,
  ) {
    await this.sendAdminCsvReport(res, req, {
      report: 'pagos-sin-telefono',
      filename: `reporte-pagos-sin-telefono-${this.todayCsvFilenameDate()}.csv`,
      branchId,
      startDate,
      endDate,
      generator: () => this.adminService.generatePagosCsvReport({
        branchId,
        startDate,
        endDate,
        includePhone: false,
      }),
    });
  }

  @Get('reportes/csv-sin-telefono/transferencias')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reporte CSV de transferencias externas sin teléfono emisor' })
  async exportCsvTransferenciasNoPhone(
    @Request() req: any,
    @Query('fechaInicio') startDate: string,
    @Query('fechaFin') endDate: string,
    @Res() res: Response,
  ) {
    await this.sendAdminCsvReport(res, req, {
      report: 'transferencias-sin-telefono',
      filename: `reporte-transferencias-sin-telefono-${this.todayCsvFilenameDate()}.csv`,
      startDate,
      endDate,
      generator: () => this.adminService.generateTransferenciasCsvReport({
        startDate,
        endDate,
        includePhone: false,
      }),
    });
  }

  @Get('reportes/csv')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reporte CSV con teléfonos (legacy — todas las transacciones)' })
  async exportCsv(
    @Request() req: any,
    @Query('sucursal') branchId: string,
    @Query('fechaInicio') startDate: string,
    @Query('fechaFin') endDate: string,
    @Res() res: Response,
  ) {
    await this.sendAdminCsvReport(res, req, {
      report: 'sistema-con-telefono',
      filename: `reporte-sistema-con-telefono-${this.todayCsvFilenameDate()}.csv`,
      branchId,
      startDate,
      endDate,
      generator: () => this.adminService.generateCsvReport({
        branchId,
        startDate,
        endDate,
        includePhone: true,
        reportType: 'all',
      }),
    });
  }

  @Get('reportes/csv-sin-telefono')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Reporte CSV sin teléfonos (legacy — todas las transacciones)' })
  async exportCsvNoPhone(
    @Request() req: any,
    @Query('sucursal') branchId: string,
    @Query('fechaInicio') startDate: string,
    @Query('fechaFin') endDate: string,
    @Res() res: Response,
  ) {
    await this.sendAdminCsvReport(res, req, {
      report: 'sistema-sin-telefono',
      filename: `reporte-sistema-sin-telefono-${this.todayCsvFilenameDate()}.csv`,
      branchId,
      startDate,
      endDate,
      generator: () => this.adminService.generateCsvReport({
        branchId,
        startDate,
        endDate,
        includePhone: false,
        reportType: 'all',
      }),
    });
  }

  private todayCsvFilenameDate(): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mexico_City',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  private async sendAdminCsvReport(
    res: Response,
    req: any,
    options: {
      report: string;
      filename: string;
      branchId?: string;
      startDate?: string;
      endDate?: string;
      generator: () => Promise<string>;
    },
  ) {
    try {
      const csv = await options.generator();
      const includePhone = !options.report.includes('sin-telefono');

      this.adminService.logCsvReportDownload({
        adminId: req.user?.id ?? req.user?.sub,
        report: options.report,
        includePhone,
        branchId: options.branchId,
        startDate: options.startDate,
        endDate: options.endDate,
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${options.filename}"`);
      res.setHeader('Cache-Control', 'no-cache');
      res.send('\uFEFF' + csv);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al generar el reporte CSV',
        error: 'INTERNAL_SERVER_ERROR',
        statusCode: 500,
      });
    }
  }

  @Get('users/:userId/clabe')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener CLABE de un usuario (solo admin)' })
  async getUserClabe(@Param('userId') userId: string) {
    return this.adminService.getUserClabe(userId);
  }

  @Post('users/:userId/clabe')
  @UseGuards(AdminJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar CLABE de un usuario (solo admin)' })
  async updateUserClabe(
    @Param('userId') userId: string,
    @Body() body: { clabe: string }
  ) {
    return this.adminService.updateUserClabe(userId, body.clabe);
  }
}
