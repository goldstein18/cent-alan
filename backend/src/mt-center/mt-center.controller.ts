import { Body, Controller, Get, HttpException, HttpStatus, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PayServiceDto, QueryBillDto } from './dto/mt-center.dto';
import { MtCenterService } from './mt-center.service';

@ApiTags('MT Center - Servicios')
@Controller('mt-center')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MtCenterController {
  constructor(private readonly mtCenterService: MtCenterService) {}

  @Get('providers')
  @ApiOperation({ summary: 'Obtener proveedores de servicios disponibles' })
  async getProviders(@Request() req: any) {
    try {
      return await this.mtCenterService.getProviders();
    } catch (error) {
      console.error('Error in getProviders controller:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al obtener proveedores';
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: errorMessage,
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('query-bill')
  @ApiOperation({ summary: 'Consultar recibo de servicio' })
  async queryBill(@Request() req: any, @Body() queryBillDto: QueryBillDto) {
    try {
      return await this.mtCenterService.queryBill(req.user.id, queryBillDto);
    } catch (error) {
      console.error('Error in queryBill controller:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al consultar el recibo';
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: errorMessage,
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('pay')
  @ApiOperation({ summary: 'Pagar servicio' })
  async payService(@Request() req: any, @Body() payServiceDto: PayServiceDto) {
    try {
      return await this.mtCenterService.payService(req.user.id, payServiceDto);
    } catch (error) {
      console.error('Error in payService controller:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al procesar el pago';
      throw new HttpException(
        {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: errorMessage,
          error: 'Internal Server Error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('payments')
  @ApiOperation({ summary: 'Obtener historial de pagos de servicios' })
  async getPaymentHistory(@Request() req: any) {
    return this.mtCenterService.getPaymentHistory(req.user.id);
  }

  @Get('balance')
  @ApiOperation({ summary: 'Consultar saldo en MT Center' })
  async getBalance(@Request() req: any) {
    try {
      return await this.mtCenterService.queryBalance();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al consultar saldo';
      throw new HttpException(
        { statusCode: HttpStatus.BAD_GATEWAY, message: errorMessage, error: 'MT Center Error' },
        HttpStatus.BAD_GATEWAY
      );
    }
  }

  @Post('query-reference')
  @ApiOperation({ summary: 'Consultar una transacción por número de ticket' })
  async queryReference(@Request() req: any, @Body() body: { numeroTicket: string }) {
    return this.mtCenterService.queryReference(body.numeroTicket);
  }

  @Post('query-transaction')
  @ApiOperation({ summary: 'Consultar una transacción específica en MT Center (legacy)' })
  async queryTransaction(@Request() req: any, @Body() body: { no_transaccion: number }) {
    return this.mtCenterService.queryTransaction(body.no_transaccion);
  }
}

