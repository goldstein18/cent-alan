import { Body, Controller, Headers, Post, Request, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OpenPayCreateCashReferenceDto, OpenPayDepositStatusDto } from './dto/openpay.dto';
import { OpenPayService } from './openpay.service';
import { PaymentOtpService } from './payment-otp.service';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly configService: ConfigService,
    private readonly paymentOtpService: PaymentOtpService,
    private readonly openPayService: OpenPayService
  ) {}

  @Post('generate-otp')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generar OTP para pago con CENT' })
  @ApiResponse({ status: 201, description: 'OTP generado exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async generatePaymentOtp(@Request() req: any, @Body() body: { phoneNumber: string }) {
    const userId = req.user.id;
    const { phoneNumber } = body;

    if (!phoneNumber) {
      throw new Error('Número de teléfono requerido');
    }

    const result = await this.paymentOtpService.generatePaymentOtp(userId, phoneNumber);
    return {
      success: result.success,
      message: 'OTP generado exitosamente. Válido por 2 minutos.',
      otp: result.otp, // Siempre retornar OTP para mostrarlo en la app
    };
  }

  @Post('openpay/cash-reference')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear referencia OpenPay para abono en efectivo (puede dirigirse por número de teléfono, estilo POS)' })
  @ApiResponse({ status: 201, description: 'Referencia de pago creada correctamente' })
  async createOpenPayCashReference(@Request() req: any, @Body() body: OpenPayCreateCashReferenceDto) {
    const userId = req.user.id;
    return this.openPayService.createCashDepositReference(userId, body);
  }

  @Post('openpay/cash-reference-pos')
  @ApiOperation({ summary: 'Crear referencia OpenPay de abono en efectivo estilo POS (sin JWT de usuario)' })
  @ApiResponse({ status: 201, description: 'Referencia de pago creada correctamente' })
  async createOpenPayCashReferencePos(
    @Headers('x-pos-api-key') posApiKey: string | undefined,
    @Body() body: OpenPayCreateCashReferenceDto
  ) {
    const expectedApiKey = this.configService.get<string>('OPENPAY_POS_API_KEY');
    if (!expectedApiKey) {
      throw new UnauthorizedException('OPENPAY_POS_API_KEY no configurada');
    }
    if (!posApiKey || posApiKey !== expectedApiKey) {
      throw new UnauthorizedException('x-pos-api-key inválida');
    }

    // userId fallback is irrelevant when phoneNumber is provided (target user resolved by phone).
    return this.openPayService.createCashDepositReference('pos-system', body);
  }

  @Post('openpay/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar estado de referencia de abono OpenPay' })
  @ApiResponse({ status: 200, description: 'Estado consultado correctamente' })
  async getOpenPayDepositStatus(@Request() req: any, @Body() body: OpenPayDepositStatusDto) {
    const userId = req.user.id;
    return this.openPayService.getDepositStatus(userId, body.reference);
  }

  @Post('openpay/webhook')
  @ApiOperation({ summary: 'Webhook OpenPay para confirmar cargos de abonos' })
  @ApiResponse({ status: 200, description: 'Webhook procesado' })
  async openPayWebhook(
    @Body() body: any,
    @Headers('x-openpay-signature') signature?: string
  ) {
    // Signature header is captured for future hardening/validation.
    if (signature) {
    }
    return this.openPayService.processWebhook(body);
  }
}

