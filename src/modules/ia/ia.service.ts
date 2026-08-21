import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RelatoriosService } from '../relatorios/relatorios.service';

export const AVISO_REVISAO_PADRAO =
  'Este relatório é um rascunho gerado automaticamente e deve ser revisado por um profissional antes do envio.';

const GEMINI_TIMEOUT_MS = 10_000;
// O relatório de atendimento pede múltiplos parágrafos correlacionando
// métricas e observações qualitativas — gera mais tokens, então damos uma
// folga maior antes de cair no fallback heurístico.
const RESUMO_ATENDIMENTO_TIMEOUT_MS = 20_000;
const GEMINI_MODEL = 'gemini-3.1-flash-lite';

interface SecaoRelatorio {
  titulo: string;
  corpo: string;
}

// Dados de uma sessão já anonimizados (sem nome/responsável/contato) para
// grounding do relatório qualitativo — ver AprendentesService.gerarRelatorioInteligente.
export interface SessaoQualitativa {
  numero: number;
  score: number;
  nivelDificuldadeMedio: number;
  atividades: string[];
  observacoes: string[];
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
    const texto = await this.chamarModeloGemini(
      this.montarPromptIA(relatorioHeuristica),
      { responseMimeType: 'application/json' },
    );
    return this.parseSecoesIA(texto, relatorioHeuristica.secoes.length);
  }

  // Enriquece o resumo textual do relatório de atendimento (usado pela tela
  // de Aprendentes) via Gemini, a partir de métricas já calculadas e
  // anonimizadas — sem nome, responsável ou qualquer dado de identificação.
  // Qualquer falha (sem API key, timeout, rede, resposta vazia) retorna null
  // para o chamador cair no texto heurístico já calculado.
  async enriquecerResumoAtendimento(dados: {
    numSessoes: number;
    mediaGeral: number;
    tendencia: string;
    avaliacao: string;
    sessoes: SessaoQualitativa[];
  }): Promise<string | null> {
    if (!process.env.GEMINI_API_KEY) {
      return null;
    }

    try {
      const texto = await this.chamarModeloGemini(
        this.montarPromptResumoAtendimento(dados),
        undefined,
        RESUMO_ATENDIMENTO_TIMEOUT_MS,
      );
      const textoLimpo = texto.trim();
      if (!textoLimpo) {
        throw new Error('Resposta vazia da IA');
      }
      return textoLimpo;
    } catch (error) {
      this.logger.warn(
        `Falha ao enriquecer resumo de atendimento via IA, usando heurística como fallback: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private montarPromptResumoAtendimento(dados: {
    numSessoes: number;
    mediaGeral: number;
    tendencia: string;
    avaliacao: string;
    sessoes: SessaoQualitativa[];
  }): string {
    const detalhamentoSessoes = dados.sessoes
      .map((s) => {
        const atividades =
          s.atividades.length > 0
            ? s.atividades.join(', ')
            : 'nenhuma registrada';
        const observacoes =
          s.observacoes.length > 0
            ? ` Observações do terapeuta: ${s.observacoes.join(' | ')}.`
            : '';
        return `Sessão ${s.numero}: score ${s.score}%, nível de dificuldade médio ${s.nivelDificuldadeMedio}, atividades: ${atividades}.${observacoes}`;
      })
      .join('\n');

    return `Você é um assistente que ajuda terapeutas neuro-psicopedagógicos a redigir relatórios clínicos profissionais.

Com base EXCLUSIVAMENTE nos dados anonimizados abaixo (métricas numéricas e observações registradas pelo terapeuta durante as sessões), escreva um relatório em múltiplos parágrafos corridos — não frases soltas, não listas, não marcadores — organizado nesta ordem de tópicos (um ou mais parágrafos por tópico, sem escrever o nome do tópico como título):
1. Tendência geral de desempenho ao longo do período.
2. Precisão/desempenho nas atividades propostas.
3. Observações qualitativas registradas nas sessões, relacionando-as com os números quando fizer sentido (ex: uma queda de score que coincide com uma observação de cansaço, agitação ou dificuldade deve ser mencionada como possível causa).
4. Recomendação para a continuidade do acompanhamento.

Regras obrigatórias:
- Não invente nenhum dado, número, observação ou fato que não esteja explicitado abaixo.
- Você não recebeu nome, responsáveis ou qualquer dado de identificação pessoal — não mencione nada disso; refira-se genericamente a "o aprendente".
- Use linguagem técnica pedagógica/clínica, adequada para constar em um relatório profissional revisado por um terapeuta.
- Se não houver observações qualitativas suficientes, foque nos tópicos numéricos disponíveis, sem inventar conteúdo qualitativo.
- Responda APENAS com o texto do relatório (os parágrafos corridos), sem markdown, sem títulos de seção, sem texto fora dos parágrafos.

Métricas gerais do período (dados anonimizados):
- Sessões com pontuação válida: ${dados.numSessoes}
- Média global de desempenho (%): ${dados.mediaGeral}
- Tendência observada: ${dados.tendencia}
- Avaliação qualitativa geral: ${dados.avaliacao}

Detalhamento por sessão (dados anonimizados):
${detalhamentoSessoes}`;
  }

  // Plumbing de baixo nível compartilhado: cria o client, aplica o timeout
  // via AbortController e devolve o texto bruto da resposta.
  private async chamarModeloGemini(
    prompt: string,
    generationConfig?: Record<string, unknown>,
    timeoutMs: number = GEMINI_TIMEOUT_MS,
  ): Promise<string> {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await model.generateContent(prompt, {
        signal: controller.signal,
        timeout: timeoutMs,
      });
      return result.response.text();
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
          'Ainda não há sessões registradas para gerar uma análise de tendência.',
      };
    }

    if (diferenca === null) {
      return {
        titulo,
        corpo:
          'Ainda não há sessões suficientes (mínimo de 3) para uma análise de tendência confiável.',
      };
    }

    if (diferenca > 0) {
      return {
        titulo,
        corpo: `Curva de aprendizagem ASCENDENTE: ganho de ${diferenca.toFixed(1)} pontos entre o início e o fim do período, indicando resposta positiva à intervenção.`,
      };
    }

    if (diferenca < 0) {
      return {
        titulo,
        corpo: `Curva de aprendizagem DESCENDENTE (${diferenca.toFixed(1)} pontos) no período. Recomenda-se investigar possíveis causas, como fadiga ou mudanças no nível de dificuldade das atividades.`,
      };
    }

    return {
      titulo,
      corpo:
        'Desempenho ESTÁVEL no período, sem variação relevante entre o início e o fim das sessões.',
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
          'Ainda não há sessões registradas para calcular a precisão média.',
      };
    }

    let corpo = `Média de acertos no período: ${mediaPrecisao}%. `;

    if (mediaPrecisao >= 80) {
      corpo += 'Índice alto, indicando bom domínio das atividades propostas.';
    } else if (mediaPrecisao >= 60) {
      corpo +=
        'Índice dentro do esperado, com erros pontuais típicos do processo de aprendizagem.';
    } else {
      corpo +=
        'Índice abaixo do esperado; recomenda-se revisar as estratégias utilizadas nas atividades.';
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

    let corpo = `De ${taxaFrequencia.totalAgendadas} sessões agendadas, ${taxaFrequencia.totalFaltas} tiveram falta (frequência de ${taxaFrequencia.taxaFrequencia}%, absenteísmo de ${taxaFrequencia.taxaAbsenteismo}%). `;

    if (taxaFrequencia.taxaAbsenteismo >= 30) {
      corpo +=
        'Taxa de faltas ALTA; recomenda-se contato com a família/rede de apoio para entender as causas.';
    } else if (taxaFrequencia.taxaAbsenteismo >= 10) {
      corpo +=
        'Taxa de faltas MODERADA; vale acompanhar a assiduidade nas próximas sessões.';
    } else {
      corpo += 'BOA frequência e adesão às sessões agendadas.';
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
        corpo: 'Não há dados suficientes para compor uma síntese.',
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
      pontosPositivos.push('boa precisão');
    } else if (mediaPrecisao < 60) {
      pontosAtencao.push('precisão baixa');
    }

    if (taxaFrequencia.taxaAbsenteismo < 10) {
      pontosPositivos.push('boa frequência');
    } else if (taxaFrequencia.taxaAbsenteismo >= 30) {
      pontosAtencao.push('faltas altas');
    }

    let corpo = '';

    if (pontosPositivos.length > 0) {
      corpo += `Pontos positivos: ${pontosPositivos.join('; ')}. `;
    }
    if (pontosAtencao.length > 0) {
      corpo += `Pontos de atenção: ${pontosAtencao.join('; ')}. `;
    }
    if (pontosPositivos.length === 0 && pontosAtencao.length === 0) {
      corpo +=
        'Quadro estável, sem indicadores que sugiram ajustes imediatos. ';
    }

    corpo +=
      'Síntese gerada automaticamente; deve ser validada pelo profissional responsável.';

    return { titulo, corpo };
  }
}
