import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RelatoriosService } from '../relatorios/relatorios.service';

export const AVISO_REVISAO_PADRAO =
  'Este relatório é um rascunho gerado automaticamente e deve ser revisado por um profissional antes do envio.';

const GEMINI_TIMEOUT_MS = 10_000;
const GEMINI_MODEL = 'gemini-1.5-flash';

interface SecaoRelatorio {
  titulo: string;
  corpo: string;
}

export interface RelatorioTextual {
  // Dados de cadastro do aprendente — só para exibição no relatório dentro do
  // sistema. NUNCA repassar para montarPromptIA/chamarGemini (PII).
  identificacao: {
    nomeCompleto: string;
    idade: number;
    inicioAcompanhamento: string;
  };
  secoes: SecaoRelatorio[];
  metricas: {
    totalSessoes: number;
    evolucaoPontos: number;
    mediaPrecisao: number;
    taxaFrequencia: number;
  };
  geradoEm: Date;
  fonte: 'heuristica' | 'ia';
  avisoRevisao: string;
}

@Injectable()
export class IaService {
  private readonly logger = new Logger(IaService.name);

  // Injeção de dependência para reaproveitar os cálculos
  constructor(private relatoriosService: RelatoriosService) {}

  // Enriquece o relatório heurístico via Gemini; qualquer falha (timeout, rede,
  // rate limit, resposta mal formada) cai automaticamente para a heurística,
  // sem quebrar a requisição do terapeuta.
  async gerarRelatorioComIA(
    aprendenteId: string,
    usuarioId: string,
  ): Promise<RelatorioTextual> {
    const relatorioHeuristica = await this.gerarRelatorioTextual(
      aprendenteId,
      usuarioId,
    );

    if (!process.env.GEMINI_API_KEY) {
      return relatorioHeuristica;
    }

    try {
      const secoesIA = await this.chamarGemini(relatorioHeuristica);
      return {
        ...relatorioHeuristica,
        secoes: secoesIA,
        fonte: 'ia',
      };
    } catch (error) {
      this.logger.warn(
        `Falha ao gerar relatório via IA, usando heurística como fallback: ${(error as Error).message}`,
      );
      return relatorioHeuristica;
    }
  }

  // Chama o Gemini com timeout curto usando apenas métricas anonimizadas e o
  // texto da heurística como grounding — nunca dados de identificação pessoal.
  private async chamarGemini(
    relatorioHeuristica: RelatorioTextual,
  ): Promise<SecaoRelatorio[]> {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: { responseMimeType: 'application/json' },
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      const result = await model.generateContent(
        this.montarPromptIA(relatorioHeuristica),
        { signal: controller.signal, timeout: GEMINI_TIMEOUT_MS },
      );
      return this.parseSecoesIA(
        result.response.text(),
        relatorioHeuristica.secoes.length,
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private montarPromptIA(relatorio: RelatorioTextual): string {
    const { metricas, secoes } = relatorio;

    return `Você é um assistente que ajuda terapeutas a redigir relatórios pedagógicos.
Reescreva as seções abaixo de forma mais fluida e profissional, mantendo EXATAMENTE a mesma quantidade de seções e a mesma ordem.

Regras obrigatórias:
- Não invente nenhum dado, número ou fato que não esteja nas métricas ou no texto original abaixo.
- Você não recebeu nome, responsáveis ou qualquer dado de identificação pessoal — não mencione nada disso.
- Mantenha o tom técnico-pedagógico e a conclusão de cada seção.
- Responda APENAS com um JSON no formato [{ "titulo": string, "corpo": string }, ...], sem markdown e sem texto fora do JSON.

Métricas (dados anonimizados):
- Total de sessões: ${metricas.totalSessoes}
- Evolução (pontos ponderados): ${metricas.evolucaoPontos}
- Precisão média (%): ${metricas.mediaPrecisao}
- Taxa de frequência (%): ${metricas.taxaFrequencia}

Texto original (heurística) por seção:
${secoes.map((secao, i) => `${i + 1}. [${secao.titulo}] ${secao.corpo}`).join('\n')}`;
  }

  private parseSecoesIA(
    texto: string,
    quantidadeEsperada: number,
  ): SecaoRelatorio[] {
    const dados: unknown = JSON.parse(texto);

    if (!Array.isArray(dados) || dados.length !== quantidadeEsperada) {
      throw new Error('Resposta da IA em formato inesperado');
    }

    return dados.map((item: unknown) => {
      if (
        typeof item !== 'object' ||
        item === null ||
        typeof (item as SecaoRelatorio).titulo !== 'string' ||
        typeof (item as SecaoRelatorio).corpo !== 'string'
      ) {
        throw new Error('Seção da IA em formato inesperado');
      }
      return {
        titulo: (item as SecaoRelatorio).titulo,
        corpo: (item as SecaoRelatorio).corpo,
      };
    });
  }

  async gerarRelatorioTextual(
    aprendenteId: string,
    usuarioId: string,
  ): Promise<RelatorioTextual> {
    const [dadosGrafico, taxaFrequencia, aprendente] = await Promise.all([
      this.relatoriosService.gerarGraficoEvolucao(aprendenteId, usuarioId),
      this.relatoriosService.getTaxaFrequencia(aprendenteId, usuarioId),
      this.relatoriosService.getIdentificacaoAprendente(
        aprendenteId,
        usuarioId,
      ),
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
      this.montarSecaoSintese(
        totalSessoes,
        diferencaTendencia,
        mediaPrecisao,
        taxaFrequencia,
      ),
    ];

    return {
      identificacao: {
        nomeCompleto: aprendente.nomeCompleto,
        idade: this.calcularIdade(aprendente.dataNascimento),
        inicioAcompanhamento: aprendente.criadoEm.toISOString().split('T')[0],
      },
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

  private calcularIdade(dataNascimento: Date): number {
    const hoje = new Date();
    let idade = hoje.getFullYear() - dataNascimento.getFullYear();
    const aindaNaoFezAniversario =
      hoje.getMonth() < dataNascimento.getMonth() ||
      (hoje.getMonth() === dataNascimento.getMonth() &&
        hoje.getDate() < dataNascimento.getDate());
    if (aindaNaoFezAniversario) {
      idade--;
    }
    return idade;
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
    const titulo = '1. ANÁLISE DE TENDÊNCIA E CURVA DE APRENDIZAGEM';

    if (totalSessoes === 0) {
      return {
        titulo,
        corpo:
          'Ainda não há sessões concluídas com atividades registradas para estabelecer uma linha de base (baseline) e gerar uma análise de tendência.',
      };
    }

    if (diferenca === null) {
      return {
        titulo,
        corpo:
          'Ainda não há sessões suficientes (mínimo de 3) para traçar uma curva de aprendizagem estatisticamente confiável. Os dados atuais podem estar sujeitos a distorção por sessões atípicas isoladas, sendo prematuro inferir uma tendência clínica neste momento.',
      };
    }

    if (diferenca > 0) {
      return {
        titulo,
        corpo: `O aprendente demonstra uma CURVA DE APRENDIZAGEM ASCENDENTE. Comparando a média das sessões mais recentes com a média das sessões iniciais do período, houve um ganho de ${diferenca.toFixed(1)} pontos ponderados. Este padrão é compatível com resposta positiva à intervenção e com indícios de neuroplasticidade favorável, sugerindo que o aprendente vem ampliando sua Zona de Desenvolvimento Proximal (ZDP), tolerando desafios de complexidade crescente sem ruptura relevante no desempenho.`,
      };
    }

    if (diferenca < 0) {
      return {
        titulo,
        corpo: `O aprendente apresenta uma CURVA DE APRENDIZAGEM DESCENDENTE (${diferenca.toFixed(1)} pontos ponderados) ao comparar a média das sessões mais recentes com a média das sessões iniciais. Recomenda-se investigação clínica dos possíveis fatores associados — fadiga, mudanças no ambiente terapêutico, sobrecarga cognitiva ou emocional — bem como avaliar se o nível de dificuldade das últimas atividades excedeu a ZDP atual, gerando frustração e resistência às tarefas propostas.`,
      };
    }

    return {
      titulo,
      corpo:
        'O aprendente apresenta ESTABILIDADE (plateau) na curva de aprendizagem ao comparar a média das sessões mais recentes com a média das sessões iniciais. A complexidade das tarefas tem sido mantida e o desempenho responde de maneira constante, o que pode indicar tanto uma fase de consolidação de habilidades quanto a necessidade de reavaliar o nível de desafio para reengajar o processo de progressão.',
    };
  }

  private montarSecaoPrecisao(
    totalSessoes: number,
    mediaPrecisao: number,
  ): SecaoRelatorio {
    const titulo = '2. PRECISÃO, ATENÇÃO SUSTENTADA E FUNÇÕES EXECUTIVAS';

    if (totalSessoes === 0) {
      return {
        titulo,
        corpo:
          'Ainda não há sessões concluídas com atividades registradas para calcular a precisão média e inferir sobre o funcionamento executivo do aprendente.',
      };
    }

    let corpo = `A média de acertos (precisão) no período foi de ${mediaPrecisao}%. `;

    if (mediaPrecisao >= 80) {
      corpo +=
        'Índice compatível com domínio consolidado das competências avaliadas, refletindo bom desempenho de atenção sustentada e controle inibitório frente às tarefas propostas. Sugere-se prontidão para progressão de nível de dificuldade.';
    } else if (mediaPrecisao >= 60) {
      corpo +=
        'Índice dentro do esperado para um processo típico de aquisição de habilidades. Os erros pontuais observados podem refletir oscilações naturais da atenção sustentada ou da memória de trabalho, esperadas neste estágio do desenvolvimento das competências trabalhadas.';
    } else {
      corpo +=
        'Índice abaixo de 60%, sugerindo possível sobrecarga das funções executivas (atenção sustentada, controle inibitório e/ou memória de trabalho) frente à demanda da tarefa. Recomenda-se avaliação qualitativa mais aprofundada dessas funções pelo profissional responsável e revisão das estratégias de mediação/andaime (scaffolding) utilizadas.';
    }

    return { titulo, corpo };
  }

  private montarSecaoFrequencia(taxaFrequencia: {
    taxaFrequencia: number;
    taxaAbsenteismo: number;
    totalAgendadas: number;
    totalFaltas: number;
  }): SecaoRelatorio {
    const titulo = '3. FREQUÊNCIA, ENGAJAMENTO E ADESÃO TERAPÊUTICA';

    if (taxaFrequencia.totalAgendadas === 0) {
      return {
        titulo,
        corpo: 'Ainda não há sessões agendadas para calcular a frequência.',
      };
    }

    let corpo = `De ${taxaFrequencia.totalAgendadas} sessões agendadas, ${taxaFrequencia.totalFaltas} tiveram registro de falta, resultando em uma taxa de frequência de ${taxaFrequencia.taxaFrequencia}% (absenteísmo de ${taxaFrequencia.taxaAbsenteismo}%). `;

    if (taxaFrequencia.taxaAbsenteismo >= 30) {
      corpo +=
        'A taxa de faltas é ALTA e compromete a adesão terapêutica e a consistência necessária para a consolidação dos ganhos neuropsicológicos observados, independentemente do desempenho nas atividades realizadas. Há risco de descontinuidade do PEI; recomenda-se contato com a família/rede de apoio para investigar barreiras de acesso ou de engajamento.';
    } else if (taxaFrequencia.taxaAbsenteismo >= 10) {
      corpo +=
        'A taxa de faltas está em nível MODERADO. Oscilações pontuais de frequência tendem a ter impacto cumulativo sobre a manutenção dos ganhos terapêuticos, valendo monitorar a assiduidade nas próximas sessões para evitar impacto na continuidade do PEI.';
    } else {
      corpo +=
        'O aprendente mantém um BOM nível de adesão terapêutica e assiduidade às sessões agendadas, o que constitui fator protetivo para a continuidade e consolidação do plano de intervenção.';
    }

    return { titulo, corpo };
  }

  private montarSecaoSintese(
    totalSessoes: number,
    diferenca: number | null,
    mediaPrecisao: number,
    taxaFrequencia: { taxaAbsenteismo: number; totalAgendadas: number },
  ): SecaoRelatorio {
    const titulo = '4. SÍNTESE CLÍNICA E ENCAMINHAMENTOS';

    if (totalSessoes === 0 || taxaFrequencia.totalAgendadas === 0) {
      return {
        titulo,
        corpo:
          'Não há dados suficientes registrados até o momento para compor uma síntese clínica. Recomenda-se retomar esta análise após o registro de novas sessões.',
      };
    }

    const pontosPositivos: string[] = [];
    const pontosAtencao: string[] = [];

    if (diferenca !== null && diferenca > 0) {
      pontosPositivos.push('curva de aprendizagem ascendente');
    } else if (diferenca !== null && diferenca < 0) {
      pontosAtencao.push('curva de aprendizagem descendente');
    }

    if (mediaPrecisao >= 80) {
      pontosPositivos.push('domínio consolidado das competências avaliadas');
    } else if (mediaPrecisao < 60) {
      pontosAtencao.push('indícios de sobrecarga das funções executivas');
    }

    if (taxaFrequencia.taxaAbsenteismo < 10) {
      pontosPositivos.push('boa adesão terapêutica');
    } else if (taxaFrequencia.taxaAbsenteismo >= 30) {
      pontosAtencao.push('baixa adesão terapêutica (alto absenteísmo)');
    }

    let corpo = '';

    if (pontosPositivos.length > 0) {
      corpo += `Pontos positivos observados: ${pontosPositivos.join('; ')}. `;
    }
    if (pontosAtencao.length > 0) {
      corpo += `Pontos que merecem atenção clínica: ${pontosAtencao.join('; ')}. `;
    }
    if (pontosPositivos.length === 0 && pontosAtencao.length === 0) {
      corpo +=
        'O quadro geral encontra-se estável, sem indicadores quantitativos que sugiram necessidade de ajustes imediatos no plano de intervenção. ';
    }

    corpo +=
      'Esta síntese é gerada automaticamente a partir de indicadores quantitativos e NÃO substitui a avaliação clínica do profissional responsável, que deve validar, contextualizar e complementar as observações acima antes de qualquer encaminhamento ao PEI ou à família/rede de apoio.';

    return { titulo, corpo };
  }
}
