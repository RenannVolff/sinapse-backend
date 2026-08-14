import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats(usuarioId: string) {
    // 1. Datas de hoje para filtrar atendimentos do dia
    const hojeInicio = new Date();
    hojeInicio.setHours(0, 0, 0, 0);

    const hojeFim = new Date();
    hojeFim.setHours(23, 59, 59, 999);

    // 2. Executa todas as consultas em paralelo (Performance extrema)
    const [totalAprendentes, atendimentosHoje, totalAtividades, mediaGeral] =
      await Promise.all([
        // A. Conta aprendentes ativos do usuário
        this.prisma.aprendente.count({
          where: { usuarioId, deletedAt: null },
        }),

        // B. Conta atendimentos agendados para HOJE
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

        // C. Conta total de atividades realizadas (Checklist marcado)
        this.prisma.itemChecklist.count({
          where: {
            realizado: true,
            atividade: {
              atendimento: { deletedAt: null, aprendente: { usuarioId } },
            },
          },
        }),

        // D. Calcula a média de evolução de TODOS os aprendentes do usuário (Score Ponderado)
        this.prisma.atividade.aggregate({
          where: {
            atendimento: { deletedAt: null, aprendente: { usuarioId } },
          },
          _avg: {
            scorePonderado: true,
          },
        }),
      ]);

    // Retorna o objeto pronto para os Cards
    return {
      totalAprendentes,
      atendimentosHoje,
      atividadesRealizadas: totalAtividades,
      mediaEvolucao: Math.round(mediaGeral._avg.scorePonderado || 0),
    };
  }

  // Gera dados reais para o Gráfico de Barras (Atendimentos nos últimos 7 dias)
  async getGraficoSemanal(usuarioId: string) {
    const hoje = new Date();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(hoje.getDate() - 6);

    const atendimentos = await this.prisma.atendimento.findMany({
      where: {
        aprendente: { usuarioId },
        deletedAt: null,
        dataAtendimento: {
          gte: seteDiasAtras,
        },
      },
      select: {
        dataAtendimento: true,
      },
    });

    // Formata para agrupar por dia (Lógica visual)
    const mapa = new Map<string, number>();

    // Inicializa os dias com 0
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(hoje.getDate() - i);
      const diaStr = d.toLocaleDateString('pt-BR', { weekday: 'short' }); // "seg", "ter"
      mapa.set(diaStr, 0);
    }

    // Preenche com os dados do banco
    atendimentos.forEach((at) => {
      const diaStr = at.dataAtendimento.toLocaleDateString('pt-BR', {
        weekday: 'short',
      });
      if (mapa.has(diaStr)) {
        mapa.set(diaStr, (mapa.get(diaStr) || 0) + 1);
      }
    });

    // Transforma em array para o gráfico
    return Array.from(mapa, ([nome, atendimentos]) => ({
      nome,
      atendimentos,
    })).reverse();
  }
}
