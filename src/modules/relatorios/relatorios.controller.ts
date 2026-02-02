import { Controller, Get, Param, Query } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Relatórios')
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly service: RelatoriosService) {}

  @Get('evolucao/:alunoId')
  @ApiOperation({
    summary: 'Gera dados para o gráfico de evolução',
    description: 'Retorna JSON formatado para Recharts (Precisão vs Evolução)',
  })
  @ApiQuery({ name: 'inicio', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'fim', required: false, example: '2026-12-31' })
  getEvolucao(
    @Param('alunoId') alunoId: string,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
  ) {
    // Conversão segura de String para Date (ou undefined)
    const dataInicio = inicio ? new Date(inicio) : undefined;
    const dataFim = fim ? new Date(fim) : undefined;

    return this.service.gerarGraficoEvolucao(alunoId, dataInicio, dataFim);
  }
}
