import { Injectable } from '@nestjs/common';
import { RelatoriosService } from '../relatorios/relatorios.service';

@Injectable()
export class IaService {
  // Injeção de dependência para reaproveitar os cálculos
  constructor(private relatoriosService: RelatoriosService) {}

  async gerarRelatorioTextual(alunoId: string) {
    const dadosGrafico =
      await this.relatoriosService.gerarGraficoEvolucao(alunoId);

    if (!dadosGrafico || dadosGrafico.length === 0) {
      return {
        texto:
          'Ainda não há dados suficientes para gerar uma análise pedagógica.',
      };
    }

    const primeiraSessao = dadosGrafico[0];
    const ultimaSessao = dadosGrafico[dadosGrafico.length - 1];

    const evolucaoGeral = ultimaSessao.evolucao - primeiraSessao.evolucao;
    const mediaPrecisao =
      dadosGrafico.reduce((acc, curr) => acc + curr.precisao, 0) /
      dadosGrafico.length;

    // Construção do Texto (Template Inteligente)
    let analise = 'RELATÓRIO DE DESEMPENHO PEDAGÓGICO\n';
    analise += '-----------------------------------\n';
    analise += `Período analisado: ${dadosGrafico.length} sessões realizadas.\n\n`;

    analise += '1. ANÁLISE DE TENDÊNCIA:\n';
    if (evolucaoGeral > 0) {
      analise += `O aprendente demonstra uma CURVA DE CRESCIMENTO POSITIVA. Houve um ganho de complexidade cognitiva de ${evolucaoGeral} pontos ponderados entre a primeira e a última sessão. Isso indica que o aluno está conseguindo lidar com tarefas progressivamente mais difíceis.`;
    } else if (evolucaoGeral < 0) {
      analise += `O aprendente apresenta uma CURVA DECRESCENTE momentânea (-${Math.abs(evolucaoGeral)} pontos). Sugere-se investigar se o nível de dificuldade das últimas atividades excedeu a zona de desenvolvimento proximal atual.`;
    } else {
      analise +=
        'O aprendente apresenta ESTABILIDADE no desempenho. A complexidade das tarefas tem sido mantida, e o aluno responde de maneira constante.';
    }

    analise += '\n\n2. PRECISÃO E ATENÇÃO:\n';
    analise += `A média de acertos (precisão) no período foi de ${Math.round(mediaPrecisao)}%. `;

    if (mediaPrecisao >= 80) {
      analise +=
        'Excelente índice de aproveitamento. Indica domínio das competências básicas propostas e sugere prontidão para aumento de nível.';
    } else if (mediaPrecisao >= 60) {
      analise +=
        'Índice dentro do esperado. O aluno realiza as atividades com bom aproveitamento, mas ainda comete erros pontuais que fazem parte do processo de aprendizagem.';
    } else {
      analise +=
        'Índice abaixo de 60%. Recomenda-se reforço nas bases e revisão das estratégias de mediação para garantir a consolidação do aprendizado.';
    }

    return {
      analiseCompleta: analise,
      metricas: {
        totalSessoes: dadosGrafico.length,
        evolucaoPontos: evolucaoGeral,
        mediaPrecisao: Math.round(mediaPrecisao),
      },
    };
  }
}
