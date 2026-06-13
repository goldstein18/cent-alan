import { Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CancelGoalDto, CreateGoalDto, FundGoalDto, WithdrawFromGoalDto } from '../types/goal';
import { GoalsService } from './goals.service';

@ApiTags('Goals')
@Controller('goals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener metas del usuario' })
  async getGoals(@Request() req: any) {
    return this.goalsService.getGoals(req.user.id);
  }

  @Get('categories')
  @ApiOperation({ summary: 'Obtener categorías de metas disponibles' })
  async getCategories() {
    return this.goalsService.getCategories();
  }

  @Post()
  @ApiOperation({ summary: 'Crear nueva meta' })
  async createGoal(@Request() req: any, @Body() createGoalDto: CreateGoalDto) {
    return this.goalsService.createGoal(req.user.id, createGoalDto);
  }

  @Put(':id/fund')
  @ApiOperation({ summary: 'Abonar a meta' })
  async fundGoal(@Request() req: any, @Param('id') id: string, @Body() fundGoalDto: FundGoalDto) {
    return this.goalsService.fundGoal(req.user.id, id, fundGoalDto);
  }

  @Put(':id/withdraw')
  @ApiOperation({ summary: 'Retirar de meta' })
  async withdrawFromGoal(@Request() req: any, @Param('id') id: string, @Body() withdrawDto: WithdrawFromGoalDto) {
    return this.goalsService.withdrawFromGoal(req.user.id, id, withdrawDto);
  }

  @Put(':id/cancel')
  @ApiOperation({ summary: 'Cancelar meta' })
  async cancelGoal(@Request() req: any, @Param('id') id: string, @Body() cancelDto: CancelGoalDto) {
    return this.goalsService.cancelGoal(req.user.id, id, cancelDto);
  }
}
