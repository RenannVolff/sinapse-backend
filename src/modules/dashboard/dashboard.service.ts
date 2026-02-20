import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    // 1. Datas de hoje para filtrar atendimentos do dia
    const hojeInicio = new Date();
    hojeInicio.setHours(0, 0, 0, 0);

    const hojeFim = new Date();
    hojeFim.setHours(23, 59, 59, 999);

    // 2. Executa todas as consultas em paralelo (Performance extrema)
    const [totalAlunos, atendimentosHoje, totalAtividades, mediaGeral] =
      await Promise.all([
        // A. Conta alunos ativos
        this.prisma.aluno.count(),

        // B. Conta atendimentos agendados para HOJE
        this.prisma.atendimento.count({
          where: {
            dataAtendimento: {
              gte: hojeInicio,
              lte: hojeFim,
            },
          },
        }),

        // C. Conta total de atividades realizadas (Checklist marcado)
        this.prisma.itemChecklist.count({
          where: { realizado: true },
        }),

        // D. Calcula a média de evolução de TODOS os alunos (Score Ponderado)
        this.prisma.atividade.aggregate({
          _avg: {
            scorePonderado: true,
          },
        }),
      ]);

    // Retorna o objeto pronto para os Cards
    return {
      totalAlunos,
      atendimentosHoje,
      atividadesRealizadas: totalAtividades,
      mediaEvolucao: Math.round(mediaGeral._avg.scorePonderado || 0),
    };
  }

  // Gera dados reais para o Gráfico de Barras (Atendimentos nos últimos 7 dias)
  async getGraficoSemanal() {
    const hoje = new Date();
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(hoje.getDate() - 6);

    const atendimentos = await this.prisma.atendimento.findMany({
      where: {
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
