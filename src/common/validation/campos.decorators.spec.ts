import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAprendenteDto } from '../../modules/aprendentes/dto/create-aprendente.dto';
import { UpdateAprendenteDto } from '../../modules/aprendentes/dto/update-aprendente.dto';
import { CreateUsuarioDto } from '../../modules/usuarios/dto/create-usuario.dto';
import { CreatePeiDto } from '../../modules/pei/dto/create-pei.dto';
import { ListarAprendentesQueryDto } from '../../modules/aprendentes/dto/listar-aprendentes-query.dto';
import { ListarPeiTemplatesQueryDto } from '../../modules/pei-templates/dto/listar-pei-templates-query.dto';
import { traduzirErrosPorCampo } from './mensagens-validacao';
import { sanitizarTexto } from './sanitizar';

async function erros(classe: new () => object, payload: object) {
  const instancia = plainToInstance(classe, payload);
  const resultado = await validate(instancia, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return { instancia, erros: traduzirErrosPorCampo(resultado) };
}

const APRENDENTE_VALIDO = {
  nomeCompleto: 'Maria José d’Ávila-Souza',
  dataNascimento: '2017-03-15',
  responsavel: 'Ana Souza',
  contato: '(47) 99999-0000',
};

describe('sanitizarTexto', () => {
  it('remove scripts e tags, mas mantém comparações em texto clínico', () => {
    expect(sanitizarTexto('  <script>alert(1)</script>Oi <b>Ana</b>  ')).toBe(
      'Oi Ana',
    );
    expect(sanitizarTexto('acertos < 5 e 3 > 2')).toBe('acertos < 5 e 3 > 2');
    expect(sanitizarTexto(10)).toBe(10);
  });
});

describe('CreateAprendenteDto', () => {
  it('aceita nome com acento, espaço, hífen e apóstrofo', async () => {
    expect((await erros(CreateAprendenteDto, APRENDENTE_VALIDO)).erros).toEqual(
      [],
    );
  });

  it('aceita ponto em abreviações ("Dr. João", "Jr.")', async () => {
    for (const nome of [
      'Dr. João Silva',
      'João Silva Jr.',
      'Ma. Ana d’Ávila',
    ]) {
      expect(
        (
          await erros(CreateAprendenteDto, {
            ...APRENDENTE_VALIDO,
            nomeCompleto: nome,
          })
        ).erros,
      ).toEqual([]);
    }
  });

  it('recusa nome que começa com ponto ou tem símbolo', async () => {
    for (const nome of ['.João', 'João @ Silva', 'Ana_Lima']) {
      const { erros: lista } = await erros(CreateAprendenteDto, {
        ...APRENDENTE_VALIDO,
        nomeCompleto: nome,
      });
      expect(lista).toEqual([
        {
          field: 'nomeCompleto',
          message:
            'Nome completo: use apenas letras, espaço, ponto, hífen ou apóstrofo.',
        },
      ]);
    }
  });

  it('recusa nome acima de 50 caracteres com erro no campo', async () => {
    const { erros: lista } = await erros(CreateAprendenteDto, {
      ...APRENDENTE_VALIDO,
      nomeCompleto: 'A'.repeat(51),
    });
    expect(lista).toEqual([
      {
        field: 'nomeCompleto',
        message: 'Nome completo: máximo de 50 caracteres.',
      },
    ]);
  });

  it('recusa nome com dígitos e limpa HTML antes de validar', async () => {
    const comDigito = await erros(CreateAprendenteDto, {
      ...APRENDENTE_VALIDO,
      nomeCompleto: 'Maria 2',
    });
    expect(comDigito.erros[0].field).toBe('nomeCompleto');

    const comTag = await erros(CreateAprendenteDto, {
      ...APRENDENTE_VALIDO,
      nomeCompleto: '<img src=x onerror=alert(1)>Maria',
    });
    expect(comTag.erros).toEqual([]);
    expect((comTag.instancia as CreateAprendenteDto).nomeCompleto).toBe(
      'Maria',
    );
  });

  it('recusa data de nascimento futura ou anterior a 120 anos', async () => {
    const futura = await erros(CreateAprendenteDto, {
      ...APRENDENTE_VALIDO,
      dataNascimento: '2999-01-01',
    });
    expect(futura.erros).toEqual([
      {
        field: 'dataNascimento',
        message: 'Data de nascimento: não pode ser uma data futura.',
      },
    ]);

    const antiga = await erros(CreateAprendenteDto, {
      ...APRENDENTE_VALIDO,
      dataNascimento: '1850-01-01',
    });
    expect(antiga.erros[0].field).toBe('dataNascimento');
  });

  it('recusa texto só com espaços em campo obrigatório', async () => {
    const { erros: lista } = await erros(CreateAprendenteDto, {
      ...APRENDENTE_VALIDO,
      responsavel: '   ',
    });
    expect(lista).toEqual([
      { field: 'responsavel', message: 'Responsável: campo obrigatório.' },
    ]);
  });

  it('na edição, aceita envio parcial mas mantém as regras do cadastro', async () => {
    expect(
      (await erros(UpdateAprendenteDto, { contato: '(47) 3333-4444' })).erros,
    ).toEqual([]);
    const { erros: lista } = await erros(UpdateAprendenteDto, {
      contato: '1'.repeat(16),
    });
    expect(lista[0].field).toBe('contato');
  });
});

describe('CreatePeiDto', () => {
  it('recusa campo descritivo acima de 2000 caracteres', async () => {
    const { erros: lista } = await erros(CreatePeiDto, {
      aprendenteId: '3f2b8c1e-7a4d-4e9b-9c0a-1d2e3f4a5b6c',
      dificuldades: 'x'.repeat(2001),
      objetivos: 'Ler',
      estrategias: 'Jogos',
      dataInicio: '2026-08-01',
    });
    expect(lista).toEqual([
      {
        field: 'dificuldades',
        message: 'Dificuldades: máximo de 2000 caracteres.',
      },
    ]);
  });
});

describe('CreateUsuarioDto.email', () => {
  const ORIGINAL = process.env.VALIDAR_DNS_EMAIL;
  beforeAll(() => (process.env.VALIDAR_DNS_EMAIL = 'false'));
  afterAll(() => (process.env.VALIDAR_DNS_EMAIL = ORIGINAL));

  const base = { nome: 'Ana Lima', senha: 'Sinapse@2026' };

  it('apara e põe em minúsculas', async () => {
    const { instancia, erros: lista } = await erros(CreateUsuarioDto, {
      ...base,
      email: '  Ana.Lima@Exemplo.COM ',
    });
    expect(lista).toEqual([]);
    expect((instancia as CreateUsuarioDto).email).toBe('ana.lima@exemplo.com');
  });

  it('sugere a correção de domínio digitado errado', async () => {
    const { erros: lista } = await erros(CreateUsuarioDto, {
      ...base,
      email: 'ana@gmial.com',
    });
    expect(lista).toEqual([
      {
        field: 'email',
        message: expect.stringContaining(
          'Você quis dizer ana@gmail.com?',
        ) as string,
      },
    ]);
  });

  it('recusa e-mail temporário', async () => {
    const { erros: lista } = await erros(CreateUsuarioDto, {
      ...base,
      email: 'ana@mailinator.com',
    });
    expect(lista[0].message).toMatch(/temporário/);
  });

  it('recusa e-mail acima de 50 caracteres', async () => {
    const { erros: lista } = await erros(CreateUsuarioDto, {
      ...base,
      email: `${'a'.repeat(45)}@x.com`,
    });
    expect(lista).toContainEqual({
      field: 'email',
      message: 'E-mail: máximo de 50 caracteres.',
    });
  });
});

describe('ListarAprendentesQueryDto / ListarPeiTemplatesQueryDto', () => {
  it('aceita a query vazia e os valores da whitelist', async () => {
    expect((await erros(ListarAprendentesQueryDto, {})).erros).toEqual([]);
    for (const sortBy of ['name', 'guardianName', 'contact']) {
      for (const order of ['asc', 'desc']) {
        expect(
          (await erros(ListarAprendentesQueryDto, { sortBy, order })).erros,
        ).toEqual([]);
      }
    }
    expect(
      (await erros(ListarPeiTemplatesQueryDto, { sortBy: 'title' })).erros,
    ).toEqual([]);
  });

  it('recusa sortBy e order fora da whitelist com mensagem no padrão', async () => {
    expect(
      (
        await erros(ListarAprendentesQueryDto, {
          sortBy: 'nomeCompleto',
          order: 'DESC',
        })
      ).erros,
    ).toEqual([
      {
        field: 'sortBy',
        message:
          'Ordenar por: use um dos valores: name, guardianName, contact.',
      },
      { field: 'order', message: 'Direção: use um dos valores: asc, desc.' },
    ]);
    expect(
      (await erros(ListarPeiTemplatesQueryDto, { sortBy: 'name' })).erros,
    ).toEqual([
      { field: 'sortBy', message: 'Ordenar por: use um dos valores: title.' },
    ]);
  });
});
