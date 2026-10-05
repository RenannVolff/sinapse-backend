import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateAtendimentoDto,
  UpdateAtendimentoDto,
} from './atendimentos.service';

function amanhaISO() {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  return amanha.toISOString();
}

async function errosDe(
  classe: new () => object,
  payload: object,
  propriedade: string,
) {
  const erros = await validate(plainToInstance(classe, payload));
  const erro = erros.find((e) => e.property === propriedade);
  return erro ? Object.values(erro.constraints ?? {}) : [];
}

const MENSAGEM_DURACAO_MAXIMA = 'A duração máxima é de 24h (1440 minutos).';

describe.each([
  ['CreateAtendimentoDto', CreateAtendimentoDto],
  ['UpdateAtendimentoDto', UpdateAtendimentoDto],
] as const)('%s.duracaoMinutos', (_nome, classe) => {
  const base = {
    aprendenteId: '11111111-1111-1111-1111-111111111111',
    tituloSessao: 'Sessão de teste',
    dataAtendimento: amanhaISO(),
  };

  it('rejeita duração 0 com mensagem em português', async () => {
    const mensagens = await errosDe(
      classe,
      { ...base, duracaoMinutos: 0 },
      'duracaoMinutos',
    );

    expect(mensagens.length).toBeGreaterThan(0);
    // Mensagem padrão do class-validator, em inglês.
    expect(mensagens).not.toContainEqual(
      expect.stringContaining('must not be less than'),
    );
  });

  it('rejeita duração 1441 com a mensagem de limite de 24h', async () => {
    const mensagens = await errosDe(
      classe,
      { ...base, duracaoMinutos: 1441 },
      'duracaoMinutos',
    );

    expect(mensagens).toContain(MENSAGEM_DURACAO_MAXIMA);
  });

  it('aceita duração de 1440 minutos (exatamente 24h)', async () => {
    const mensagens = await errosDe(
      classe,
      { ...base, duracaoMinutos: 1440 },
      'duracaoMinutos',
    );

    expect(mensagens).toEqual([]);
  });

  it('aceita duracaoMinutos ausente (campo opcional)', async () => {
    const mensagens = await errosDe(classe, base, 'duracaoMinutos');

    expect(mensagens).toEqual([]);
  });
});

describe('UpdateAtendimentoDto.dataAtendimento', () => {
  it('rejeita o texto "banana" como data inválida', async () => {
    const mensagens = await errosDe(
      UpdateAtendimentoDto,
      { dataAtendimento: 'banana' },
      'dataAtendimento',
    );

    expect(mensagens).toContain('Data inválida');
  });

  it('rejeita uma data passada', async () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);

    const mensagens = await errosDe(
      UpdateAtendimentoDto,
      { dataAtendimento: ontem.toISOString() },
      'dataAtendimento',
    );

    expect(mensagens).toContain(
      'Não é possível agendar um atendimento em uma data anterior a hoje.',
    );
  });

  it('aceita uma data futura', async () => {
    const mensagens = await errosDe(
      UpdateAtendimentoDto,
      { dataAtendimento: amanhaISO() },
      'dataAtendimento',
    );

    expect(mensagens).toEqual([]);
  });

  it('aceita payload sem dataAtendimento (campo opcional na edição)', async () => {
    const mensagens = await errosDe(
      UpdateAtendimentoDto,
      { tituloSessao: 'Novo título' },
      'dataAtendimento',
    );

    expect(mensagens).toEqual([]);
  });
});
