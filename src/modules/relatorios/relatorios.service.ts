import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client'; // Importante para tipagem estrita

@Injectable()
export class RelatoriosService {
  constructor(private prisma: PrismaService) {}

  // Gera os dados para o Gráfico de Linha Dupla
  async gerarGraficoEvolucao(alunoId: string, inicio?: Date, fim?: Date) {
    // Construção do objeto WHERE com tipagem do Prisma
    const whereCondition: Prisma.AtendimentoWhereInput = {
      alunoId,
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
}
