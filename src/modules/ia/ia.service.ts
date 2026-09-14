import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { RelatoriosService } from '../relatorios/relatorios.service';

export const AVISO_REVISAO_PADRAO =
  'Este relatório é um rascunho gerado automaticamente e deve ser revisado por um profissional antes do envio.';

// Orçamento TOTAL para "tentar IA antes da heurística" — não é por tentativa.
// A cascata abaixo pode passar por vários modelos/provedores dentro desse
// mesmo orçamento (cada tentativa usa o tempo que sobrou), então o pior caso
// nunca ultrapassa este valor, só o distribui entre mais chances de sucesso.
const GEMINI_TIMEOUT_MS = 15_000;
// O relatório de atendimento pede múltiplos parágrafos correlacionando
// métricas e observações qualitativas — gera mais tokens, então damos uma
// folga maior antes de cair no fallback heurístico.
const RESUMO_ATENDIMENTO_TIMEOUT_MS = 20_000;
// Não vale a pena tentar mais um modelo/provedor com menos que isso de
// orçamento restante — não dá tempo de uma resposta real, só desperdiça um
// round-trip de rede.
const TEMPO_MINIMO_TENTATIVA_MS = 2_000;

// Cascata de modelos Gemini, do mais leve pro mais robusto. Todos são aliases
// "rolling" da Google (sempre apontam pra versão atual daquela categoria) em
// vez de nomes de versão fixos — modelos pinados (ex: gemini-3.1-flash-lite)
// já ficaram indisponíveis com 503 "high demand"/depreciados sem aviso, e
// aliases sofrem bem menos disso. Categorias diferentes (lite/flash/pro)
// também tendem a ter pools de capacidade separados no lado da Google, então
// uma sobrecarga pontual numa categoria não derruba as outras.
const GEMINI_MODELS_CASCATA = [
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-pro-latest',
];

// Camada extra, só ativa se GROQ_API_KEY estiver configurada (conta grátis em
// console.groq.com) — cai aqui apenas se TODOS os modelos Gemini acima
// falharem, garantindo uma segunda chance de resposta real da IA antes da
// heurística. API compatível com o formato OpenAI, chamada via fetch nativo
// (sem SDK novo).
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODELS_CASCATA = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

// Última camada antes da heurística, só ativa se OPENROUTER_API_KEY estiver
// configurada (conta grátis em openrouter.ai/keys) — entra apenas se TODOS os
// modelos Gemini E Groq acima falharem. Também compatível com o formato
// OpenAI, reaproveitando o mesmo helper de baixo nível do Groq (só muda
// endpoint/modelos). O catálogo ":free" da OpenRouter (GET
// https://openrouter.ai/api/v1/models, público, sem precisar de chave) muda
// com bastante frequência (mais até que os modelos "oficiais" do Gemini) e
// vários modelos listados como ":free" na prática respondem 403/429 ou
// travam — os 3 abaixo foram testados manualmente (chat completion real +
// modo JSON) em 2026-09-14 e responderam rápido (<1s a ~3s) e corretamente;
// revalide contra o catálogo/teste real antes de assumir bug de código se
// essa camada começar a falhar.
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_CASCATA = [
  'nex-agi/nex-n2.5-mini:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3-super-120b-a12b:free',
];

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

  // Enriquece o relatório heurístico via IA (cascata Gemini + Groq + OpenRouter, ver
  // chamarIAComFallback); qualquer falha em todos os provedores/modelos
  // (timeout, rede, rate limit, resposta mal formada) cai automaticamente
  // para a heurística, sem quebrar a requisição do terapeuta.
  async gerarRelatorioComIA(
    aprendenteId: string,
    usuarioId: string,
  ): Promise<RelatorioTextual> {
    const relatorioHeuristica = await this.gerarRelatorioTextual(
      aprendenteId,
      usuarioId,
    );

    if (!this.algumProvedorIAConfigurado()) {
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

  // Pede as seções em JSON via cascata de IA, usando apenas métricas
  // anonimizadas e o texto da heurística como grounding — nunca dados de
  // identificação pessoal.
  private async chamarGemini(
    relatorioHeuristica: RelatorioTextual,
  ): Promise<SecaoRelatorio[]> {
    const texto = await this.chamarIAComFallback(
      this.montarPromptIA(relatorioHeuristica),
      { json: true, timeoutMs: GEMINI_TIMEOUT_MS },
    );
    return this.parseSecoesIA(texto, relatorioHeuristica.secoes.length);
  }

  // Enriquece o resumo textual do relatório de atendimento (usado pela tela
  // de Aprendentes) via cascata de IA, a partir de métricas já calculadas e
  // anonimizadas — sem nome, responsável ou qualquer dado de identificação.
  // Qualquer falha (sem nenhuma API key, timeout, rede, resposta vazia)
  // retorna null para o chamador cair no texto heurístico já calculado.
  async enriquecerResumoAtendimento(dados: {
    numSessoes: number;
    mediaGeral: number;
    tendencia: string;
    avaliacao: string;
    sessoes: SessaoQualitativa[];
  }): Promise<string | null> {
    if (!this.algumProvedorIAConfigurado()) {
      return null;
    }

    try {
      const texto = await this.chamarIAComFallback(
        this.montarPromptResumoAtendimento(dados),
        { json: false, timeoutMs: RESUMO_ATENDIMENTO_TIMEOUT_MS },
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

  private algumProvedorIAConfigurado(): boolean {
    return Boolean(
      process.env.GEMINI_API_KEY ||
        process.env.GROQ_API_KEY ||
        process.env.OPENROUTER_API_KEY,
    );
  }

  // Tenta a cascata Gemini e, se todos os modelos falharem, cai pra cascata
  // Groq e depois OpenRouter (cada uma só ativa se sua respectiva API key
  // estiver configurada) — ordem: Gemini → Groq → OpenRouter → heurística.
  // Só propaga o erro pro chamador (que aciona a heurística) depois de
  // esgotar todo mundo. O orçamento de tempo é total, não por tentativa: cada
  // modelo/provedor usa o tempo que sobrou do timeoutMs original, então o
  // pior caso nunca ultrapassa o timeout configurado.
  private async chamarIAComFallback(
    prompt: string,
    opcoes: { json: boolean; timeoutMs: number },
  ): Promise<string> {
    const prazoFinal = Date.now() + opcoes.timeoutMs;
    const erros: string[] = [];

    const tentativas: { rotulo: string; chamar: (tempoMs: number) => Promise<string> }[] = [];

    if (process.env.GEMINI_API_KEY) {
      for (const modelo of GEMINI_MODELS_CASCATA) {
        tentativas.push({
          rotulo: `Gemini/${modelo}`,
          chamar: (tempoMs) =>
            this.chamarGeminiModelo(prompt, modelo, opcoes.json, tempoMs),
        });
      }
    }

    if (process.env.GROQ_API_KEY) {
      for (const modelo of GROQ_MODELS_CASCATA) {
        tentativas.push({
          rotulo: `Groq/${modelo}`,
          chamar: (tempoMs) =>
            this.chamarApiCompativelOpenAI(
              GROQ_API_URL,
              process.env.GROQ_API_KEY!,
              modelo,
              prompt,
              opcoes.json,
              tempoMs,
            ),
        });
      }
    }

    if (process.env.OPENROUTER_API_KEY) {
      for (const modelo of OPENROUTER_MODELS_CASCATA) {
        tentativas.push({
          rotulo: `OpenRouter/${modelo}`,
          chamar: (tempoMs) =>
            this.chamarApiCompativelOpenAI(
              OPENROUTER_API_URL,
              process.env.OPENROUTER_API_KEY!,
              modelo,
              prompt,
              opcoes.json,
              tempoMs,
            ),
        });
      }
    }

    for (const tentativa of tentativas) {
      const tempoRestante = prazoFinal - Date.now();
      if (tempoRestante < TEMPO_MINIMO_TENTATIVA_MS) {
        break;
      }

      try {
        return await tentativa.chamar(tempoRestante);
      } catch (error) {
        erros.push(`${tentativa.rotulo}: ${(error as Error).message}`);
      }
    }

    throw new Error(
      erros.length > 0
        ? `Todos os provedores de IA falharam: ${erros.join(' | ')}`
        : 'Nenhum provedor de IA configurado (defina GEMINI_API_KEY, GROQ_API_KEY e/ou OPENROUTER_API_KEY).',
    );
  }

  // Chama um modelo Gemini específico com timeout via AbortController e
  // devolve o texto bruto da resposta.
  private async chamarGeminiModelo(
    prompt: string,
    modelo: string,
    json: boolean,
    timeoutMs: number,
  ): Promise<string> {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: modelo,
      ...(json
        ? { generationConfig: { responseMimeType: 'application/json' } }
        : {}),
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

  // Chama um modelo específico de um provedor compatível com o formato de
  // chat completions da OpenAI (Groq, OpenRouter) via fetch nativo, com o
  // mesmo contrato de timeout dos modelos Gemini. Reaproveitado pelas duas
  // camadas — só muda endpoint/chave/modelo.
  private async chamarApiCompativelOpenAI(
    url: string,
    apiKey: string,
    modelo: string,
    prompt: string,
    json: boolean,
    timeoutMs: number,
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const resposta = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelo,
          messages: [{ role: 'user', content: prompt }],
          ...(json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: controller.signal,
      });

      if (!resposta.ok) {
        const corpoErro = await resposta.text();
        throw new Error(
          `respondeu ${resposta.status}: ${corpoErro.slice(0, 200)}`,
        );
      }

      const dados = (await resposta.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const texto = dados.choices?.[0]?.message?.content;
      if (!texto) {
        throw new Error('retornou resposta sem conteúdo');
      }
      return texto;
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
- Responda APENAS com um JSON no formato { "secoes": [{ "titulo": string, "corpo": string }, ...] }, sem markdown e sem texto fora do JSON.

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
    const json: unknown = JSON.parse(texto);

    // Gemini aceita array solto no topo; provedores compatíveis com o modo
    // JSON da OpenAI (ex: Groq) exigem um objeto no nível raiz — aceitamos
    // as duas formas em vez de depender de cada modelo seguir o formato à risca.
    const dados: unknown =
      json !== null &&
      typeof json === 'object' &&
      Array.isArray((json as { secoes?: unknown }).secoes)
        ? (json as { secoes: unknown }).secoes
        : json;

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
