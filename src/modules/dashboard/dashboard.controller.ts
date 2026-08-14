import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Retorna os contadores dos Cards do Dashboard' })
  getStats(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getDashboardStats(user.id);
  }

  @Get('graficos')
  @ApiOperation({ summary: 'Retorna os dados para os gráficos' })
  getGraficos(@CurrentUser() user: AuthenticatedUser) {
    return this.service.getGraficoSemanal(user.id);
  }
}
