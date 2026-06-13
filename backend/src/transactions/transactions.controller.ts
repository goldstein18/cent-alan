import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DepositDto, PaymentDto, TransactionFilters, TransferExternalDto, TransferInternalDto } from '../types/transaction';
import { TransactionsService } from './transactions.service';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener historial de transacciones' })
  async getTransactions(@Request() req: any, @Query() filters: TransactionFilters) {
    return this.transactionsService.getTransactions(req.user.id, req.user.phoneNumber, filters);
  }

  @Post('transfer-internal')
  @ApiOperation({ summary: 'Transferencia interna entre usuarios' })
  async transferInternal(@Request() req: any, @Body() transferDto: TransferInternalDto) {
    return this.transactionsService.transferInternal(req.user.id, transferDto, req.user.phoneNumber);
  }

  @Post('transfer-external')
  @ApiOperation({ summary: 'Transferencia externa a banco' })
  async transferExternal(@Request() req: any, @Body() transferDto: TransferExternalDto) {
    return this.transactionsService.transferExternal(req.user.id, transferDto);
  }

  @Get('transfer-external')
  @ApiOperation({ summary: 'Obtener transferencias externas realizadas' })
  async getExternalTransfers(@Request() req: any, @Query('limit') limit?: number) {
    const parsedLimit = limit ? Number(limit) : undefined;
    return this.transactionsService.getExternalTransfers(req.user.id, parsedLimit);
  }

  @Post('deposit')
  @ApiOperation({ summary: 'Abono a cuenta' })
  async deposit(@Request() req: any, @Body() depositDto: DepositDto) {
    return this.transactionsService.deposit(req.user.id, depositDto);
  }

  @Post('payment')
  @ApiOperation({ summary: 'Pago de servicios' })
  async payment(@Request() req: any, @Body() paymentDto: PaymentDto) {
    return this.transactionsService.payment(req.user.id, paymentDto);
  }
}
