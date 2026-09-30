import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { calcularScoreSessao } from '../../common/utils/calcular-score';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(usuarioId: string) {
    const hojeInicio = new Date();
    hojeInicio.setHours(0, 0, 0, 0);

    const hojeFim = new Date();
    hojeFim.setHours(23, 59, 59, 999);

    const [
      totalAprendentes,
      atendimentosHoje,
      totalAtividades,
      sessoesConcluidas,
    ] = await Promise.all([
        this.prisma.aprendente.count({
          where: { usuarioId, deletedAt: null },
        }),

        this.prisma.atendimento.count({
          where: {
            aprendente: { usuarioId },
            deletedAt: null,
            dataAtendimento: {
              gte: hojeInicio,
              lte: hojeFim,
            },
          },
        }),

        // Conta itens de checklist marcados, não atividades — apesar do card
        // se chamar "atividades realizadas".
        this.prisma.itemChecklist.count({
          where: {
            realizado: true,
            atividade: {
              atendimento: { deletedAt: null, aprendente: { usuarioId } },
            },
          },
        }),

        // Mesmo critério do gráfico de evolução em Relatórios: só sessões
        // finalizadas entram na média.
        this.prisma.atendimento.findMany({
          where: {
            aprendente: { usuarioId },
            deletedAt: null,
            concluido: true,
          },
          select: {
            atividades: {
              select: {
                nivelDificuldade: true,
                itensChecklist: { select: { realizado: true } },
              },
            },
          },
        }),
      ]);

    // Média por sessão (não por atividade), sobre todos os aprendentes do usuário.
    const mediaEvolucao =
      sessoesConcluidas.length > 0
        ? Math.round(
            sessoesConcluidas.reduce(
              (acc, sessao) => acc + calcularScoreSessao(sessao),
              0,
            ) / sessoesConcluidas.length,
          )
        : 0;

    return {
      totalAprendentes,
      atendimentosHoje,
      atividadesRealizadas: totalAtividades,
      mediaEvolucao,
    };
  }

  // Gráfico de barras: atendimentos por dia nos últimos 7 dias
  async getGraficoSemanal(usuarioId: string) {
    const hoje = new Date();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(hoje.getDate() - 6);
    seteDiasAtras.setHours(0, 0, 0, 0);

    const hojeFim = new Date();
    hojeFim.setHours(23, 59, 59, 999);

    // O agrupamento é só pelo nome do dia ("seg", "ter"): sem o limite
    // superior, um agendamento da próxima segunda cairia na barra da segunda
    // passada.
    const atendimentos = await this.prisma.atendimento.findMany({
      where: {
        aprendente: { usuarioId },
        deletedAt: null,
        dataAtendimento: {
          gte: seteDiasAtras,
          lte: hojeFim,
        },
      },
      select: {
        dataAtendimento: true,
      },
    });

    // Pré-preenche com 0 para dias sem atendimento ainda aparecerem no gráfico
    const mapa = new Map<string, number>();

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(hoje.getDate() - i);
      const diaStr = d.toLocaleDateString('pt-BR', { weekday: 'short' }); // "seg", "ter"
      mapa.set(diaStr, 0);
    }

    atendimentos.forEach((at) => {
      const diaStr = at.dataAtendimento.toLocaleDateString('pt-BR', {
        weekday: 'short',
      });
      if (mapa.has(diaStr)) {
        mapa.set(diaStr, (mapa.get(diaStr) || 0) + 1);
      }
    });

    // O mapa foi montado de hoje para trás; reverse deixa em ordem cronológica
    return Array.from(mapa, ([nome, atendimentos]) => ({
      nome,
      atendimentos,
    })).reverse();
  }
}
