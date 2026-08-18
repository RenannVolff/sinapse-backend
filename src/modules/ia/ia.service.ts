import { Injectable } from '@nestjs/common';
import { RelatoriosService } from '../relatorios/relatorios.service';

export const AVISO_REVISAO_PADRAO =
  'Este relatório é um rascunho gerado automaticamente e deve ser revisado por um profissional antes do envio.';

interface SecaoRelatorio {
  titulo: string;
  corpo: string;
}

export interface RelatorioTextual {
  secoes: SecaoRelatorio[];
  metricas: {
    totalSessoes: number;
    evolucaoPontos: number;
    mediaPrecisao: number;
    taxaFrequencia: number;
  };
  geradoEm: Date;
  fonte: 'heuristica';
  avisoRevisao: string;
}

@Injectable()
export class IaService {
  // Injeção de dependência para reaproveitar os cálculos
  constructor(private relatoriosService: RelatoriosService) {}

  async gerarRelatorioTextual(
    aprendenteId: string,
    usuarioId: string,
  ): Promise<RelatorioTextual> {
    const [dadosGrafico, taxaFrequencia] = await Promise.all([
      this.relatoriosService.gerarGraficoEvolucao(aprendenteId, usuarioId),
      this.relatoriosService.getTaxaFrequencia(aprendenteId, usuarioId),
    ]);

    const totalSessoes = dadosGrafico.length;
    const diferencaTendencia =
      totalSessoes >= 3
        ? this.calcularGruposTendencia(dadosGrafico).diferenca
        : null;
    const evolucaoPontos =
      diferencaTendencia !== null ? Number(diferencaTendencia.toFixed(1)) : 0;
    const mediaPrecisao = this.calcularMediaPrecisao(dadosGrafico);

    const secoes: SecaoRelatorio[] = [
      this.montarSecaoTendencia(totalSessoes, diferencaTendencia),
      this.montarSecaoPrecisao(totalSessoes, mediaPrecisao),
      this.montarSecaoFrequencia(taxaFrequencia),
    ];

    return {
      secoes,
      metricas: {
        totalSessoes,
        evolucaoPontos,
        mediaPrecisao,
        taxaFrequencia: taxaFrequencia.taxaFrequencia,
      },
      geradoEm: new Date(),
      fonte: 'heuristica',
      avisoRevisao: AVISO_REVISAO_PADRAO,
    };
  }

  // Divide as sessões em grupo inicial/final para suavizar sessões atípicas isoladas.
  // Com 6+ sessões, compara as 3 primeiras contra as 3 últimas; com menos, usa metade/metade.
  private calcularGruposTendencia(dadosGrafico: { evolucao: number }[]) {
    const total = dadosGrafico.length;
    const tamanhoGrupo = total >= 6 ? 3 : Math.floor(total / 2);

    const grupoInicial = dadosGrafico.slice(0, tamanhoGrupo);
    const grupoFinal = dadosGrafico.slice(total - tamanhoGrupo);

    const mediaInicial =
      grupoInicial.reduce((acc, curr) => acc + curr.evolucao, 0) / tamanhoGrupo;
    const mediaFinal =
      grupoFinal.reduce((acc, curr) => acc + curr.evolucao, 0) / tamanhoGrupo;

    return { diferenca: mediaFinal - mediaInicial, mediaInicial, mediaFinal };
  }

  private calcularMediaPrecisao(dadosGrafico: { precisao: number }[]) {
    if (dadosGrafico.length === 0) {
      return 0;
    }
    return Math.round(
      dadosGrafico.reduce((acc, curr) => acc + curr.precisao, 0) /
        dadosGrafico.length,
    );
  }

  private montarSecaoTendencia(
    totalSessoes: number,
    diferenca: number | null,
  ): SecaoRelatorio {
    const titulo = '1. ANÁLISE DE TENDÊNCIA';

    if (totalSessoes === 0) {
      return {
        titulo,
        corpo:
          'Ainda não há sessões concluídas com atividades registradas para gerar uma análise de tendência.',
      };
    }

    if (diferenca === null) {
      return {
        titulo,
        corpo:
          'Ainda não há sessões suficientes (mínimo de 3) para uma análise de tendência confiável. Os dados atuais podem estar sujeitos a distorção por sessões atípicas isoladas.',
      };
    }

    if (diferenca > 0) {
      return {
        titulo,
        corpo: `O aprendente demonstra uma CURVA DE CRESCIMENTO POSITIVA. Comparando a média das sessões mais recentes com a média das sessões iniciais do período, houve um ganho de ${diferenca.toFixed(1)} pontos ponderados. Isso indica que o aprendente está conseguindo lidar com tarefas progressivamente mais difíceis.`,
      };
    }

    if (diferenca < 0) {
      return {
        titulo,
        corpo: `O aprendente apresenta uma CURVA DECRESCENTE (${diferenca.toFixed(1)} pontos ponderados) ao comparar a média das sessões mais recentes com a média das sessões iniciais. Sugere-se investigar se o nível de dificuldade das últimas atividades excedeu a zona de desenvolvimento proximal atual.`,
      };
    }

    return {
      titulo,
      corpo:
        'O aprendente apresenta ESTABILIDADE no desempenho ao comparar a média das sessões mais recentes com a média das sessões iniciais. A complexidade das tarefas tem sido mantida, e o aprendente responde de maneira constante.',
    };
  }

  private montarSecaoPrecisao(
    totalSessoes: number,
    mediaPrecisao: number,
  ): SecaoRelatorio {
    const titulo = '2. PRECISÃO E ATENÇÃO';

    if (totalSessoes === 0) {
      return {
        titulo,
        corpo:
          'Ainda não há sessões concluídas com atividades registradas para calcular a precisão média.',
      };
    }

    let corpo = `A média de acertos (precisão) no período foi de ${mediaPrecisao}%. `;

    if (mediaPrecisao >= 80) {
      corpo +=
        'Excelente índice de aproveitamento. Indica domínio das competências básicas propostas e sugere prontidão para aumento de nível.';
    } else if (mediaPrecisao >= 60) {
      corpo +=
        'Índice dentro do esperado. O aprendente realiza as atividades com bom aproveitamento, mas ainda comete erros pontuais que fazem parte do processo de aprendizagem.';
    } else {
      corpo +=
        'Índice abaixo de 60%. Recomenda-se reforço nas bases e revisão das estratégias de mediação para garantir a consolidação do aprendizado.';
    }

    return { titulo, corpo };
  }

  private montarSecaoFrequencia(taxaFrequencia: {
    taxaFrequencia: number;
    taxaAbsenteismo: number;
    totalAgendadas: number;
    totalFaltas: number;
  }): SecaoRelatorio {
    const titulo = '3. FREQUÊNCIA E ENGAJAMENTO';

    if (taxaFrequencia.totalAgendadas === 0) {
      return {
        titulo,
        corpo: 'Ainda não há sessões agendadas para calcular a frequência.',
      };
    }

    let corpo = `De ${taxaFrequencia.totalAgendadas} sessões agendadas, ${taxaFrequencia.totalFaltas} tiveram registro de falta, resultando em uma taxa de frequência de ${taxaFrequencia.taxaFrequencia}% (absenteísmo de ${taxaFrequencia.taxaAbsenteismo}%). `;

    if (taxaFrequencia.taxaAbsenteismo >= 30) {
      corpo +=
        'A taxa de faltas é ALTA e compromete a continuidade do acompanhamento, independentemente do desempenho nas atividades realizadas. Recomenda-se revisar o plano de atendimento junto à família/responsáveis, investigando barreiras de acesso ou engajamento.';
    } else if (taxaFrequencia.taxaAbsenteismo >= 10) {
      corpo +=
        'A taxa de faltas está em nível MODERADO. Vale monitorar a frequência nas próximas sessões para evitar impacto na continuidade do PEI.';
    } else {
      corpo +=
        'O aprendente mantém um BOM nível de engajamento e assiduidade às sessões agendadas.';
    }

    return { titulo, corpo };
  }
}
