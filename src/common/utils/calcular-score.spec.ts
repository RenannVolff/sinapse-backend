import {
  AtividadeParaScore,
  calcularPrecisaoSessao,
  calcularScoreSessao,
} from './calcular-score';

// Monta uma atividade com `marcados` itens realizados de um total de `total`.
function atividade(
  marcados: number,
  total: number,
  nivelDificuldade = 1,
): AtividadeParaScore {
  return {
    nivelDificuldade,
    itensChecklist: Array.from({ length: total }, (_, i) => ({
      realizado: i < marcados,
    })),
  };
}

describe('calcularScoreSessao', () => {
  it('retorna 0 para sessão sem atividades', () => {
    expect(calcularScoreSessao({ atividades: [] })).toBe(0);
  });

  it('conta atividade sem itens de checklist como 0, sem lançar erro', () => {
    const sessao = { atividades: [atividade(0, 0)] };

    expect(() => calcularScoreSessao(sessao)).not.toThrow();
    expect(calcularScoreSessao(sessao)).toBe(0);
  });

  it('calcula 67 para checklist de 3 itens com 2 marcados', () => {
    expect(calcularScoreSessao({ atividades: [atividade(2, 3)] })).toBe(67);
  });

  it('dá 100 tanto para checklist de 5 itens quanto de 3 itens completos (sem divisor fixo em 5)', () => {
    expect(calcularScoreSessao({ atividades: [atividade(5, 5)] })).toBe(100);
    expect(calcularScoreSessao({ atividades: [atividade(3, 3)] })).toBe(100);
  });

  it('pondera pelo nível de dificuldade: a atividade de peso 3 pesa mais que a de peso 1', () => {
    const dificilCompleta = calcularScoreSessao({
      atividades: [atividade(4, 4, 3), atividade(0, 4, 1)],
    });
    const facilCompleta = calcularScoreSessao({
      atividades: [atividade(0, 4, 3), atividade(4, 4, 1)],
    });

    expect(dificilCompleta).toBe(75);
    expect(facilCompleta).toBe(25);
  });

  it('calcula 33 para atividade sem checklist + atividade com 2/3 marcados, com pesos iguais', () => {
    const sessao = { atividades: [atividade(0, 0, 2), atividade(2, 3, 2)] };

    expect(calcularScoreSessao(sessao)).toBe(33);
  });

  describe('arredondamento (Math.round) nos limites', () => {
    it('arredonda 33,33 para baixo (33)', () => {
      expect(calcularScoreSessao({ atividades: [atividade(1, 3)] })).toBe(33);
    });

    it('arredonda 12,5 para cima (13)', () => {
      expect(calcularScoreSessao({ atividades: [atividade(1, 8)] })).toBe(13);
    });

    it('arredonda 99,5 para 100', () => {
      expect(calcularScoreSessao({ atividades: [atividade(199, 200)] })).toBe(
        100,
      );
    });

    it('mantém 99,4 em 99', () => {
      expect(calcularScoreSessao({ atividades: [atividade(497, 500)] })).toBe(
        99,
      );
    });

    it('retorna sempre um inteiro', () => {
      const score = calcularScoreSessao({
        atividades: [atividade(1, 3, 2), atividade(2, 7, 5)],
      });

      expect(Number.isInteger(score)).toBe(true);
    });
  });
});

describe('calcularPrecisaoSessao', () => {
  it('retorna 0 para sessão sem atividades', () => {
    expect(calcularPrecisaoSessao({ atividades: [] })).toBe(0);
  });

  it('conta atividade sem itens de checklist como 0, sem lançar erro', () => {
    const sessao = { atividades: [atividade(0, 0), atividade(1, 1)] };

    expect(() => calcularPrecisaoSessao(sessao)).not.toThrow();
    expect(calcularPrecisaoSessao(sessao)).toBe(50);
  });

  it('é média simples dos acertos, sem ponderar pelo nível de dificuldade', () => {
    const sessao = { atividades: [atividade(4, 4, 3), atividade(0, 4, 1)] };

    expect(calcularPrecisaoSessao(sessao)).toBe(50);
    // Mesma sessão, score ponderado diverge da precisão.
    expect(calcularScoreSessao(sessao)).toBe(75);
  });

  it('arredonda a média de 12,5 para cima (13)', () => {
    const sessao = { atividades: [atividade(0, 4), atividade(1, 4)] };

    expect(calcularPrecisaoSessao(sessao)).toBe(13);
  });

  it('arredonda a média de 33,33 para baixo (33)', () => {
    const sessao = { atividades: [atividade(0, 0), atividade(2, 3)] };

    expect(calcularPrecisaoSessao(sessao)).toBe(33);
  });
});
