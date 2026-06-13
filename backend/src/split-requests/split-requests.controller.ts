import { Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AcceptSplitRequestDto, CreateSplitRequestDto } from '../types/split-request';
import { SplitRequestsService } from './split-requests.service';

@ApiTags('Split Requests (Dividir Cuentas)')
@Controller('split-requests')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SplitRequestsController {
  constructor(private readonly splitRequestsService: SplitRequestsService) {}

  @Get('sent')
  @ApiOperation({ summary: 'Obtener solicitudes enviadas' })
  async getSentRequests(@Request() req: any) {
    return this.splitRequestsService.getSentRequests(req.user.id);
  }

  @Get('received')
  @ApiOperation({ summary: 'Obtener solicitudes recibidas' })
  async getReceivedRequests(@Request() req: any) {
    return this.splitRequestsService.getReceivedRequests(req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de solicitud' })
  async getRequestDetail(@Request() req: any, @Param('id') id: string) {
    return this.splitRequestsService.getRequestDetail(req.user.id, id);
  }

  @Get(':id/participant-id')
  @ApiOperation({ summary: 'Obtener ID de participante para solicitud recibida' })
  async getParticipantId(@Request() req: any, @Param('id') id: string) {
    const participantId = await this.splitRequestsService.getParticipantIdForReceivedRequest(req.user.id, id);
    return { participantId };
  }

  @Post()
  @ApiOperation({ summary: 'Crear solicitud de división' })
  async createSplitRequest(@Request() req: any, @Body() body: CreateSplitRequestDto & { pin: string }) {
    const { pin, ...dto } = body;
    return this.splitRequestsService.createSplitRequest(req.user.id, dto, pin || '');
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancelar solicitud' })
  async cancelSplitRequest(@Request() req: any, @Param('id') id: string, @Body() body: { pin: string }) {
    return this.splitRequestsService.cancelSplitRequest(req.user.id, id, body.pin);
  }

  @Put('participants/:participantId/accept')
  @ApiOperation({ summary: 'Aceptar solicitud recibida' })
  async acceptSplitRequest(@Request() req: any, @Param('participantId') participantId: string, @Body() dto: AcceptSplitRequestDto) {
    return this.splitRequestsService.acceptSplitRequest(req.user.id, participantId, dto);
  }

  @Put('participants/:participantId/reject')
  @ApiOperation({ summary: 'Rechazar solicitud recibida' })
  async rejectSplitRequest(@Request() req: any, @Param('participantId') participantId: string) {
    return this.splitRequestsService.rejectSplitRequest(req.user.id, participantId);
  }
}
