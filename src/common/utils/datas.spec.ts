import {
  diaParaArmazenar,
  extrairDia,
  fimDoDia,
  hojeNoFuso,
  inicioDoDia,
  normalizarPeriodo,
} from './datas';

describe('extrairDia', () => {
  it('aceita AAAA-MM-DD e ISO completo, usando o dia como foi escrito', () => {
    expect(extrairDia('2026-10-01')).toBe('2026-10-01');
    expect(extrairDia('2026-10-01T23:30:00-03:00')).toBe('2026-10-01');
  });

  it('recusa data de calendário inexistente ou texto qualquer', () => {
    expect(extrairDia('2026-02-30')).toBeNull();
    expect(extrairDia('banana')).toBeNull();
    expect(extrairDia(20261001)).toBeNull();
  });
});

describe('datas só-dia não viram o dia anterior', () => {
  it('grava ao meio-dia UTC: em Brasília continua o mesmo dia', () => {
    const gravada = diaParaArmazenar('2017-03-15');
    expect(gravada.toISOString()).toBe('2017-03-15T12:00:00.000Z');
    expect(
      gravada.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    ).toBe('15/03/2017');
  });

  it('filtro cobre o dia inteiro no fuso de Brasília', () => {
    expect(inicioDoDia('2026-10-01').toISOString()).toBe(
      '2026-10-01T03:00:00.000Z',
    );
    expect(fimDoDia('2026-10-01').toISOString()).toBe(
      '2026-10-02T02:59:59.999Z',
    );
  });

  it('"hoje" segue o relógio de Brasília, não o UTC do servidor', () => {
    // 01h UTC do dia 23 ainda é dia 22 às 22h em Brasília
    expect(hojeNoFuso(new Date('2026-10-23T01:00:00.000Z'))).toBe('2026-10-22');
  });
});

describe('normalizarPeriodo', () => {
  it('troca início e fim invertidos e avisa', () => {
    const periodo = normalizarPeriodo('2026-12-31', '2026-01-01');
    expect(periodo).toMatchObject({
      inicio: '2026-01-01',
      fim: '2026-12-31',
      invertido: true,
    });
    expect(periodo.desde!.getTime()).toBeLessThan(periodo.ate!.getTime());
  });

  it('mantém período em ordem e aceita pontas ausentes', () => {
    expect(normalizarPeriodo('2026-01-01', '2026-01-01')).toMatchObject({
      invertido: false,
    });
    expect(normalizarPeriodo(undefined, '2026-01-01')).toMatchObject({
      inicio: undefined,
      fim: '2026-01-01',
      invertido: false,
      desde: undefined,
    });
  });
});
