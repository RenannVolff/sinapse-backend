import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, StatusAtendimento } from '@prisma/client'; // Importante para tipagem estrita

export type AgrupamentoFrequencia = 'mensal' | 'trimestral';

// Status considerados no cálculo de sessões "encerradas" (que já tiveram desfecho)
const STATUS_AGRUPADOS = [
  StatusAtendimento.CONCLUIDO,
  StatusAtendimento.FALTA,
  StatusAtendimento.CANCELADO,
] as const;

@Injectable()
export class RelatoriosService {
  constructor(private prisma: PrismaService) {}

  // Gera os dados para o Gráfico de Linha Dupla
  async gerarGraficoEvolucao(
    aprendenteId: string,
    usuarioId: string,
    inicio?: Date,
    fim?: Date,
  ) {
    // Construção do objeto WHERE com tipagem do Prisma
    const whereCondition: Prisma.AtendimentoWhereInput = {
      aprendenteId,
      aprendente: { usuarioId },
      deletedAt: null,
      concluido: true,
    };

    // Adiciona filtros de data se existirem
    if (inicio || fim) {
      whereCondition.dataAtendimento = {};
      if (inicio) {
        whereCondition.dataAtendimento.gte = inicio; // Maior ou igual
      }
      if (fim) {
        whereCondition.dataAtendimento.lte = fim; // Menor ou igual
      }
    }

    // Busca no banco
    const atendimentos = await this.prisma.atendimento.findMany({
      where: whereCondition,
      include: {
        atividades: {
          select: {
            percentualAcerto: true,
            scorePonderado: true,
          },
        },
      },
      orderBy: { dataAtendimento: 'asc' },
    });

    // Processamento matemático
    return atendimentos.map((at) => {
      const qtdAtividades = at.atividades.length || 1;

      const somaPrecisao = at.atividades.reduce(
        (acc, curr) => acc + curr.percentualAcerto,
        0,
      );
      const somaScore = at.atividades.reduce(
        (acc, curr) => acc + curr.scorePonderado,
        0,
      );

      return {
        data: at.dataAtendimento.toISOString().split('T')[0],
        precisao: Math.round(somaPrecisao / qtdAtividades),
        evolucao: Math.round(somaScore / qtdAtividades),
        sessao: at.tituloSessao,
      };
    });
  }

  // Garante que o aprendente existe e pertence ao usuário logado (multi-tenancy)
  private async validarAprendente(aprendenteId: string, usuarioId: string) {
    const aprendente = await this.prisma.aprendente.findFirst({
      where: { id: aprendenteId, usuarioId, deletedAt: null },
      select: { id: true },
    });
    if (!aprendente) {
      throw new NotFoundException('Aprendente não encontrado.');
    }
  }

  // Taxa de frequência/absenteísmo: total de sessões agendadas vs. quantas foram FALTA
  async getTaxaFrequencia(aprendenteId: string, usuarioId: string) {
    await this.validarAprendente(aprendenteId, usuarioId);

    const whereBase: Prisma.AtendimentoWhereInput = {
      aprendenteId,
      aprendente: { usuarioId },
      deletedAt: null,
    };

    const [totalAgendadas, totalConcluidas, totalFaltas, totalCancelados] =
      await Promise.all([
        this.prisma.atendimento.count({ where: whereBase }),
        this.prisma.atendimento.count({
          where: { ...whereBase, status: StatusAtendimento.CONCLUIDO },
        }),
        this.prisma.atendimento.count({
          where: { ...whereBase, status: StatusAtendimento.FALTA },
        }),
        this.prisma.atendimento.count({
          where: { ...whereBase, status: StatusAtendimento.CANCELADO },
        }),
      ]);

    const taxaAbsenteismo =
      totalAgendadas > 0
        ? Number(((totalFaltas / totalAgendadas) * 100).toFixed(1))
        : 0;

    return {
      aprendenteId,
      totalAgendadas,
      totalConcluidas,
      totalFaltas,
      totalCancelados,
      taxaAbsenteismo,
      taxaFrequencia: Number((100 - taxaAbsenteismo).toFixed(1)),
    };
  }

  // Total de sessões por status (CONCLUIDO, FALTA, CANCELADO) agrupado por mês ou trimestre.
  // Sem aprendenteId: agregado para todos os aprendentes do usuário logado.
  async getSessoesPorStatusAgrupado(
    usuarioId: string,
    agrupamento: AgrupamentoFrequencia,
    aprendenteId?: string,
  ) {
    if (aprendenteId) {
      await this.validarAprendente(aprendenteId, usuarioId);
    }

    const where: Prisma.AtendimentoWhereInput = aprendenteId
      ? { aprendenteId, aprendente: { usuarioId }, deletedAt: null }
      : { aprendente: { usuarioId }, deletedAt: null };

    const atendimentos = await this.prisma.atendimento.findMany({
      where: { ...where, status: { in: [...STATUS_AGRUPADOS] } },
      select: { dataAtendimento: true, status: true },
      orderBy: { dataAtendimento: 'asc' },
    });

    return this.agruparPorPeriodo(atendimentos, agrupamento);
  }

  private obterChavePeriodo(
    data: Date,
    agrupamento: AgrupamentoFrequencia,
  ): string {
    const ano = data.getFullYear();
    if (agrupamento === 'trimestral') {
      const trimestre = Math.floor(data.getMonth() / 3) + 1;
      return `${ano}-T${trimestre}`;
    }
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    return `${ano}-${mes}`;
  }

  private agruparPorPeriodo(
    atendimentos: { dataAtendimento: Date; status: StatusAtendimento }[],
    agrupamento: AgrupamentoFrequencia,
  ) {
    const mapa = new Map<string, Record<(typeof STATUS_AGRUPADOS)[number], number>>();

    for (const at of atendimentos) {
      const chave = this.obterChavePeriodo(at.dataAtendimento, agrupamento);
      if (!mapa.has(chave)) {
        mapa.set(chave, { CONCLUIDO: 0, FALTA: 0, CANCELADO: 0 });
      }
      const contagem = mapa.get(chave)!;
      contagem[at.status as (typeof STATUS_AGRUPADOS)[number]] += 1;
    }

    return Array.from(mapa.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([periodo, contagem]) => ({
        periodo,
        ...contagem,
        total: contagem.CONCLUIDO + contagem.FALTA + contagem.CANCELADO,
      }));
  }

  // Combina resumo (taxa) e evolução por período para um aprendente específico
  async getFrequenciaAprendente(
    aprendenteId: string,
    usuarioId: string,
    agrupamento: AgrupamentoFrequencia,
  ) {
    const [resumo, porPeriodo] = await Promise.all([
      this.getTaxaFrequencia(aprendenteId, usuarioId),
      this.getSessoesPorStatusAgrupado(usuarioId, agrupamento, aprendenteId),
    ]);

    return { resumo, porPeriodo };
  }
}
