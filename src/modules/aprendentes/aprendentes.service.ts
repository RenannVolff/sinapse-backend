import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAprendenteDto } from './dto/create-aprendente.dto';

@Injectable()
export class AprendentesService {
  constructor(private prisma: PrismaService) {}

  create(data: CreateAprendenteDto, usuarioId: string) {
    return this.prisma.aprendente.create({
      data: {
        nomeCompleto: data.nomeCompleto,
        dataNascimento: new Date(data.dataNascimento),
        responsavel: data.responsavel,
        contato: data.contato,
        usuarioId,
      },
    });
  }

  findAll(usuarioId: string) {
    return this.prisma.aprendente.findMany({
      where: { usuarioId },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async findOne(id: string, usuarioId: string) {
    const aprendente = await this.prisma.aprendente.findFirst({
      where: { id, usuarioId },
      include: {
        atendimentos: {
          orderBy: { dataAtendimento: 'desc' },
        },
      },
    });

    if (!aprendente) throw new NotFoundException('Aprendente não encontrado.');
    return aprendente;
  }

  // --- RELATÓRIO AUTÔNOMO (HEURÍSTICO) ---
  async gerarRelatorioInteligente(
    aprendenteId: string,
    dataInicioIso: string,
    dataFimIso: string,
    usuarioId: string,
  ) {
    const inicio = new Date(dataInicioIso);
    const fim = new Date(dataFimIso);
    fim.setHours(23, 59, 59, 999);

    const sessoes = await this.prisma.atendimento.findMany({
      where: {
        aprendenteId,
        aprendente: { usuarioId },
        dataAtendimento: {
          gte: inicio,
          lte: fim,
        },
      },
      orderBy: { dataAtendimento: 'asc' },
      include: {
        aprendente: { select: { nomeCompleto: true } },
        atividades: { include: { itensChecklist: true } },
      },
    });

    if (sessoes.length === 0) {
      return {
        resumoIa:
          'Não há atendimentos registrados para este paciente no período selecionado.',
        dadosGrafico: [],
      };
    }

    const nomeAprendente = sessoes[0].aprendente.nomeCompleto;

    // 1. Calcula os gráficos matemáticos
    const dadosGrafico = sessoes.map((sessao) => {
      let scoreTotalSessao = 0;
      let pesoTotalSessao = 0;

      sessao.atividades.forEach((ativ) => {
        const acertos = ativ.itensChecklist.filter((i) => i.realizado).length;
        const scoreAtividade = (acertos / 5) * 100;

        scoreTotalSessao += scoreAtividade * ativ.nivelDificuldade;
        pesoTotalSessao += ativ.nivelDificuldade;
      });

      const mediaSessao =
        pesoTotalSessao > 0
          ? Math.round(scoreTotalSessao / pesoTotalSessao)
          : 0;

      return {
        data: sessao.dataAtendimento.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        }),
        titulo: sessao.tituloSessao,
        score: mediaSessao,
      };
    });

    const dadosValidos = dadosGrafico.filter((d) => d.score > 0);

    let resumoIa = '';

    if (dadosValidos.length > 0) {
      const numSessoes = dadosValidos.length;
      const mediaGeral = Math.round(
        dadosValidos.reduce((acc, curr) => acc + curr.score, 0) / numSessoes,
      );

      const primeiraSessao = dadosValidos[0].score;
      const ultimaSessao = dadosValidos[numSessoes - 1].score;

      let tendencia = '';
      if (numSessoes === 1)
        tendencia = 'estabilidade inicial (apenas uma sessão analisada)';
      else if (ultimaSessao > primeiraSessao + 5)
        tendencia = 'evolução progressiva do quadro';
      else if (ultimaSessao < primeiraSessao - 5)
        tendencia = 'declínio no rendimento, exigindo atenção';
      else tendencia = 'estabilidade cognitiva';

      let avaliacao = '';
      if (mediaGeral >= 80)
        avaliacao = 'excelente assimilação das atividades propostas';
      else if (mediaGeral >= 50)
        avaliacao =
          'desenvolvimento dentro do esperado para o nível de dificuldade';
      else
        avaliacao =
          'necessidade de maior intervenção e adaptação dos estímulos';

      resumoIa = `Análise Sistêmica Automática: No período selecionado, o aprendente ${nomeAprendente} realizou atividades avaliativas com pontuação válida em ${numSessoes} sessão(ões). A média global de desempenho cognitivo-matemático foi de ${mediaGeral}%, indicando uma ${avaliacao}. Ao observar o histórico, nota-se uma tendência de ${tendencia}. O sistema recomenda a continuidade dos atendimentos ajustando o nível de dificuldade com base nesta métrica.`;
    } else {
      resumoIa =
        'As sessões encontradas não possuem atividades com checklists marcados para gerar o laudo matemático.';
    }

    return { resumoIa, dadosGrafico: dadosValidos };
  }
}
