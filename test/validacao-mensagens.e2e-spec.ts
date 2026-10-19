import { AppTeste, criarAppTeste } from './helpers/app-teste';
import {
  bearer,
  criarAprendente,
  criarAtendimento,
  criarTerapeuta,
  horarioFuturo,
  Terapeuta,
} from './helpers/fabrica';

// Qualquer resquício das mensagens padrão do class-validator em inglês.
const INGLES =
  /\b(must|should|property|each value|not exist|empty|string|number|array|boolean|integer|UUID$)\b/i;

describe('F. Mensagens de validação em português', () => {
  let ctx: AppTeste;
  let t: Terapeuta;
  let aprendenteId: string;
  let atendimentoId: string;

  beforeAll(async () => {
    ctx = await criarAppTeste();
    t = await criarTerapeuta(ctx);
    aprendenteId = (await criarAprendente(ctx, t)).id;
    atendimentoId = (
      await criarAtendimento(ctx, t, aprendenteId, {
        dataAtendimento: horarioFuturo(80, 10),
      })
    ).id;
  });

  afterAll(async () => {
    await ctx.fechar();
  });

  function semIngles(message: unknown) {
    expect(Array.isArray(message)).toBe(true);
    for (const m of message as string[]) expect(m).not.toMatch(INGLES);
  }

  function semRepeticao(message: string[]) {
    expect(new Set(message).size).toBe(message.length);
  }

  const casos: {
    nome: string;
    metodo: 'post' | 'patch';
    url: () => string;
    auth: boolean;
    corpo: () => object;
    esperadas: string[];
  }[] = [
    {
      nome: 'POST /usuarios com campo extra',
      metodo: 'post',
      url: () => '/usuarios',
      auth: false,
      corpo: () => ({
        nome: 'Pessoa',
        email: 'pessoa@e2e.sinapse.test',
        senha: 'SenhaForte@123',
        admin: true,
      }),
      esperadas: ['O campo admin não deve existir.'],
    },
    {
      nome: 'POST /auth/login com campo extra e e-mail inválido',
      metodo: 'post',
      url: () => '/auth/login',
      auth: false,
      corpo: () => ({ email: 'x', senha: 'abc', extra: 1 }),
      esperadas: ['O campo extra não deve existir.', 'E-mail inválido'],
    },
    {
      nome: 'POST /aprendentes vazio',
      metodo: 'post',
      url: () => '/aprendentes',
      auth: true,
      corpo: () => ({}),
      esperadas: [
        'O campo nomeCompleto é obrigatório.',
        'O campo responsavel é obrigatório.',
        'O campo contato é obrigatório.',
        'Data inválida',
      ],
    },
    {
      nome: 'POST /peis com aprendenteId inválido',
      metodo: 'post',
      url: () => '/peis',
      auth: true,
      corpo: () => ({
        aprendenteId: 'abc',
        dificuldades: 'x',
        objetivos: 'x',
        estrategias: 'x',
        dataInicio: '2026-01-01',
      }),
      esperadas: [
        'O campo aprendenteId deve ser um identificador (UUID) válido.',
      ],
    },
    {
      nome: 'PATCH /aprendentes/:id/fase com fase inexistente',
      metodo: 'patch',
      url: () => `/aprendentes/${aprendenteId}/fase`,
      auth: true,
      corpo: () => ({ fase: 'XPTO' }),
      esperadas: [],
    },
    {
      nome: 'PATCH /tarefas/:id com tipos errados',
      metodo: 'patch',
      url: () => '/tarefas/00000000-0000-4000-8000-000000000000',
      auth: true,
      corpo: () => ({ texto: 1, concluida: 'sim' }),
      esperadas: [
        'O campo texto deve ser um texto.',
        'O campo concluida deve ser verdadeiro ou falso.',
      ],
    },
    {
      nome: 'POST /aprendentes/:id/exportar-docx com gráfico inválido',
      metodo: 'post',
      url: () => `/aprendentes/${aprendenteId}/exportar-docx`,
      auth: true,
      corpo: () => ({
        nomeAprendente: 'A',
        resumoIa: 'R',
        graficos: [{ titulo: '', imagemBase64: '***', extra: 1 }],
      }),
      esperadas: [
        'O campo graficos.0.extra não deve existir.',
        'O campo graficos.0.titulo é obrigatório.',
        'O campo graficos.0.imagemBase64 deve estar codificado em base64.',
      ],
    },
    {
      nome: 'POST /atividades com campo extra',
      metodo: 'post',
      url: () => '/atividades',
      auth: true,
      corpo: () => ({
        atendimentoId,
        titulo: 'x',
        nivelDificuldade: 2,
        hack: 1,
      }),
      esperadas: ['O campo hack não deve existir.'],
    },
  ];

  it.each(casos.map((c) => [c.nome, c] as const))(
    '%s responde 400 só com mensagens em português',
    async (_nome, caso) => {
      const req = ctx.api[caso.metodo](caso.url());
      if (caso.auth) req.set(bearer(t.token));
      const res = await req.send(caso.corpo()).expect(400);

      expect(res.body).toEqual({
        statusCode: 400,
        message: expect.any(Array),
        timestamp: expect.any(String),
        path: caso.url(),
      });
      for (const m of caso.esperadas) expect(res.body.message).toContain(m);
      semIngles(res.body.message);
      semRepeticao(res.body.message);
    },
  );

  it('PATCH /aprendentes/:id/fase lista as fases válidas em português', async () => {
    const res = await ctx.api
      .patch(`/aprendentes/${aprendenteId}/fase`)
      .set(bearer(t.token))
      .send({ fase: 'XPTO' })
      .expect(400);
    expect(res.body.message).toEqual([
      expect.stringMatching(
        /^O campo fase deve ser um dos seguintes valores: /,
      ),
    ]);
  });

  it('POST /atividades sem atendimentoId devolve uma única mensagem para o campo', async () => {
    const res = await ctx.api
      .post('/atividades')
      .set(bearer(t.token))
      .send({ titulo: 'x', nivelDificuldade: 2 })
      .expect(400);
    expect(res.body.message).toEqual([
      'O identificador do atendimento é obrigatório.',
    ]);
  });

  it('GET /atendimentos/calendario com mês inválido não repete a mensagem', async () => {
    const res = await ctx.api
      .get('/atendimentos/calendario')
      .query({ mes: 'abc', ano: 2027 })
      .set(bearer(t.token))
      .expect(400);
    expect(res.body.message).toEqual([
      'O mês deve ser um número inteiro de 1 a 12.',
    ]);
  });

  it('GET em query com parâmetro desconhecido diz que o campo não deve existir', async () => {
    const res = await ctx.api
      .get(`/relatorios/evolucao/${aprendenteId}`)
      .query({ foo: 'bar' })
      .set(bearer(t.token))
      .expect(400);
    expect(res.body.message).toEqual(['O campo foo não deve existir.']);
  });

  it('rota inexistente responde 404 em português', async () => {
    const res = await ctx.api
      .get('/rota-que-nao-existe')
      .set(bearer(t.token))
      .expect(404);
    expect(res.body.message).toBe('Rota não encontrada.');
  });

  it('JSON malformado responde 400 em português', async () => {
    const res = await ctx.api
      .post('/aprendentes')
      .set(bearer(t.token))
      .set('Content-Type', 'application/json')
      .send('{"nomeCompleto": ')
      .expect(400);
    expect(res.body.message).toBe(
      'O corpo da requisição não é um JSON válido.',
    );
  });

  it('parâmetro de rota com codificação inválida responde 400 em português', async () => {
    const res = await ctx.api
      .get('/aprendentes/%FF')
      .set(bearer(t.token))
      .expect(400);
    expect(res.body.message).toBe(
      'O endereço da requisição contém caracteres inválidos.',
    );
  });
});
