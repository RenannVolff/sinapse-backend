import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Retorna os contadores dos Cards do Dashboard' })
  getStats() {
    return this.service.getDashboardStats();
  }

  @Get('graficos')
  @ApiOperation({ summary: 'Retorna os dados para os gráficos' })
  getGraficos() {
    return this.service.getGraficoSemanal();
  }
}
