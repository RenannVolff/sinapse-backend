// Fonte única do score de sessão, usada por Aprendentes, Relatórios e
// Dashboard. Os campos Atividade.percentualAcerto/scorePonderado do schema
// nunca são gravados — não use-os no lugar destas funções.

export interface AtividadeParaScore {
  nivelDificuldade: number;
  itensChecklist: { realizado: boolean }[];
}

export interface SessaoParaScore {
  atividades: AtividadeParaScore[];
}

// Atividade sem checklist conta como 0, sem derrubar a sessão inteira.
function percentualAcertoAtividade(ativ: AtividadeParaScore): number {
  const totalItens = ativ.itensChecklist.length;
  if (totalItens === 0) return 0;
  const acertos = ativ.itensChecklist.filter((i) => i.realizado).length;
  return (acertos / totalItens) * 100;
}

// Score 0-100 da sessão, ponderado pelo nível de dificuldade de cada atividade.
export function calcularScoreSessao(sessao: SessaoParaScore): number {
  let scoreTotal = 0;
  let pesoTotal = 0;

  sessao.atividades.forEach((ativ) => {
    scoreTotal += percentualAcertoAtividade(ativ) * ativ.nivelDificuldade;
    pesoTotal += ativ.nivelDificuldade;
  });

  return pesoTotal > 0 ? Math.round(scoreTotal / pesoTotal) : 0;
}

// Precisão 0-100 da sessão: média simples de acertos, sem ponderar pela
// dificuldade. É a segunda linha do gráfico de evolução, ao lado do score.
export function calcularPrecisaoSessao(sessao: SessaoParaScore): number {
  if (sessao.atividades.length === 0) return 0;
  const soma = sessao.atividades.reduce(
    (acc, ativ) => acc + percentualAcertoAtividade(ativ),
    0,
  );
  return Math.round(soma / sessao.atividades.length);
}
