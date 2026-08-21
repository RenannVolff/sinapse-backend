import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { RelatoriosService } from './relatorios.service';
import type { AgrupamentoFrequencia } from './relatorios.service';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

function parseAgrupamento(agrupamento?: string): AgrupamentoFrequencia {
  if (!agrupamento || agrupamento === 'mensal') return 'mensal';
  if (agrupamento === 'trimestral') return 'trimestral';
  throw new BadRequestException(
    "Parâmetro 'agrupamento' inválido. Use 'mensal' ou 'trimestral'.",
  );
}

@ApiTags('Relatórios')
@Controller('relatorios')
export class RelatoriosController {
  constructor(private readonly service: RelatoriosService) {}

  @Get('evolucao/:aprendenteId')
  @ApiOperation({
    summary: 'Gera dados para o gráfico de evolução',
    description: 'Retorna JSON formatado para Recharts (Precisão vs Evolução)',
  })
  @ApiQuery({ name: 'inicio', required: false, example: '2026-01-01' })
  @ApiQuery({ name: 'fim', required: false, example: '2026-12-31' })
  getEvolucao(
    @Param('aprendenteId') aprendenteId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
  ) {
    // Conversão segura de String para Date (ou undefined)
    const dataInicio = inicio ? new Date(inicio) : undefined;
    const dataFim = fim ? new Date(fim) : undefined;

    return this.service.gerarGraficoEvolucao(
      aprendenteId,
      user.id,
      dataInicio,
      dataFim,
    );
  }

  @Get('aprendente/:id/frequencia')
  @ApiOperation({
    summary: 'Taxa de frequência/absenteísmo de um aprendente',
    description:
      'Retorna o resumo de comparecimento (AGENDADO vs. FALTA) e o total de ' +
      'sessões por status (CONCLUIDO, FALTA, CANCELADO) agrupado por mês ou trimestre.',
  })
  @ApiQuery({
    name: 'agrupamento',
    required: false,
    enum: ['mensal', 'trimestral'],
  })
  getFrequenciaAprendente(
    @Param('id') aprendenteId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('agrupamento') agrupamento?: string,
  ) {
    return this.service.getFrequenciaAprendente(
      aprendenteId,
      user.id,
      parseAgrupamento(agrupamento),
    );
  }

  @Get('frequencia')
  @ApiOperation({
    summary:
      'Total de sessões por status agregado para todos os aprendentes do usuário logado',
    description:
      'Agrupa CONCLUIDO, FALTA e CANCELADO por mês ou trimestre, somando todos os aprendentes do usuário autenticado.',
  })
  @ApiQuery({
    name: 'agrupamento',
    required: false,
    enum: ['mensal', 'trimestral'],
  })
  getFrequenciaAgregada(
    @CurrentUser() user: AuthenticatedUser,
    @Query('agrupamento') agrupamento?: string,
  ) {
    return this.service.getSessoesPorStatusAgrupado(
      user.id,
      parseAgrupamento(agrupamento),
    );
  }
}
