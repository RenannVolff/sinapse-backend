import {
  AppTeste,
  clienteHttp,
  criarAppTeste,
  novoIp,
} from './helpers/app-teste';
import {
  bearer,
  criarTerapeuta,
  emailUnico,
  SENHA_PADRAO,
  Terapeuta,
} from './helpers/fabrica';

const MENSAGEM_429 =
  'Muitas requisições. Aguarde um momento e tente novamente.';
const UUID_QUALQUER = '00000000-0000-4000-8000-000000000000';

describe('E. Proteção', () => {
  let ctx: AppTeste;
  let t: Terapeuta;

  beforeAll(async () => {
    ctx = await criarAppTeste();
    t = await criarTerapeuta(ctx);
  });

  afterAll(async () => {
    await ctx.fechar();
  });

  describe('Rate limit (throttler) por rota', () => {
    // Corpos propositalmente inválidos: o ThrottlerGuard roda antes da
    // validação e da autenticação, então até as requisições rejeitadas
    // (400/401) consomem a cota — o que interessa aqui é só a contagem.
    const rotas: {
      nome: string;
      limite: number;
      metodo: 'get' | 'post';
      url: string;
      corpo?: object;
      query?: object;
    }[] = [
      {
        nome: 'POST /auth/login',
        limite: 5,
        metodo: 'post',
        url: '/auth/login',
        corpo: {},
      },
      {
        nome: 'POST /auth/2fa/verificar-login',
        limite: 5,
        metodo: 'post',
        url: '/auth/2fa/verificar-login',
        corpo: {},
      },
      {
        nome: 'POST /usuarios (cadastro)',
        limite: 5,
        metodo: 'post',
        url: '/usuarios',
        corpo: {},
      },
      {
        nome: 'GET /auth/verificar-email',
        limite: 10,
        metodo: 'get',
        url: '/auth/verificar-email',
        query: { token: 'x' },
      },
      {
        nome: 'POST /auth/reenviar-verificacao',
        limite: 3,
        metodo: 'post',
        url: '/auth/reenviar-verificacao',
        corpo: {},
      },
      {
        nome: 'POST /auth/esqueci-senha',
        limite: 3,
        metodo: 'post',
        url: '/auth/esqueci-senha',
        corpo: {},
      },
      {
        nome: 'POST /auth/redefinir-senha',
        limite: 5,
        metodo: 'post',
        url: '/auth/redefinir-senha',
        corpo: {},
      },
      {
        nome: 'POST /auth/2fa/ativar',
        limite: 5,
        metodo: 'post',
        url: '/auth/2fa/ativar',
        corpo: {},
      },
      {
        nome: 'POST /auth/2fa/desativar',
        limite: 5,
        metodo: 'post',
        url: '/auth/2fa/desativar',
        corpo: {},
      },
      {
        nome: 'GET /aprendentes/:id/relatorio-ia',
        limite: 10,
        metodo: 'get',
        url: `/aprendentes/${UUID_QUALQUER}/relatorio-ia`,
      },
      {
        nome: 'POST /aprendentes/:id/exportar-docx',
        limite: 10,
        metodo: 'post',
        url: `/aprendentes/${UUID_QUALQUER}/exportar-docx`,
        corpo: {},
      },
      {
        nome: 'GET /aprendentes (limite padrão)',
        limite: 100,
        metodo: 'get',
        url: '/aprendentes',
      },
    ];

    it.each(rotas.map((r) => [r.nome, r.limite, r] as const))(
      '%s: aceita %i requisições por IP e responde 429 em português na seguinte',
      async (_nome, limite, rota) => {
        const cliente = clienteHttp(ctx.app, novoIp());
        const enviar = () => {
          const req = cliente[rota.metodo](rota.url);
          if (rota.query) req.query(rota.query);
          return rota.corpo ? req.send(rota.corpo) : req;
        };

        for (let i = 1; i <= limite; i++) {
          const res = await enviar();
          expect(res.status).not.toBe(429);
        }

        const bloqueada = await enviar();
        expect(bloqueada.status).toBe(429);
        expect(bloqueada.body.message).toBe(MENSAGEM_429);
        expect(Number(bloqueada.headers['retry-after'])).toBeGreaterThan(0);
      },
    );

    it('o bloqueio é por IP: outro IP continua passando na mesma rota', async () => {
      const ipBloqueado = clienteHttp(ctx.app, novoIp());
      for (let i = 0; i < 5; i++)
        await ipBloqueado.post('/auth/login').send({});
      await ipBloqueado.post('/auth/login').send({}).expect(429);

      // Login real com credenciais corretas, de outro IP.
      await clienteHttp(ctx.app, novoIp())
        .post('/auth/login')
        .send({ email: t.email, senha: t.senha })
        .expect(200);
    });

    it('o bloqueio é por rota: o IP bloqueado no login ainda acessa outras rotas', async () => {
      const cliente = clienteHttp(ctx.app, novoIp());
      for (let i = 0; i < 5; i++) await cliente.post('/auth/login').send({});
      await cliente.post('/auth/login').send({}).expect(429);

      await cliente.get('/aprendentes').set(bearer(t.token)).expect(200);
    });

    it('o 429 bloqueia antes de checar a senha: nem a credencial correta passa', async () => {
      const cliente = clienteHttp(ctx.app, novoIp());
      for (let i = 0; i < 5; i++) {
        await cliente
          .post('/auth/login')
          .send({ email: t.email, senha: 'Errada@123' })
          .expect(401);
      }
      await cliente
        .post('/auth/login')
        .send({ email: t.email, senha: t.senha })
        .expect(429);
    });
  });

  describe('Headers de segurança (helmet)', () => {
    it.each([
      [
        'rota pública com erro de validação',
        '/auth/verificar-email',
        undefined,
      ],
      ['rota protegida sem token (401)', '/aprendentes', undefined],
      ['rota protegida autenticada (200)', '/aprendentes', 'auth'],
    ])('envia os headers do helmet em %s', async (_caso, url, auth) => {
      const req = ctx.api.get(url);
      if (auth) req.set(bearer(t.token));
      const res = await req;

      expect(res.headers).toMatchObject({
        'content-security-policy':
          expect.stringContaining("default-src 'self'"),
        'strict-transport-security': expect.stringContaining('max-age='),
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'SAMEORIGIN',
        'referrer-policy': 'no-referrer',
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-resource-policy': 'same-origin',
        'x-dns-prefetch-control': 'off',
        'x-download-options': 'noopen',
        'x-permitted-cross-domain-policies': 'none',
        'x-xss-protection': '0',
      });
      expect(res.headers).not.toHaveProperty('x-powered-by');
    });
  });

  describe('Honeypot', () => {
    it('login com o campo honeypot preenchido responde 200 no mesmo formato do login real, com um token que não abre nenhuma rota', async () => {
      const real = await ctx.api
        .post('/auth/login')
        .send({ email: t.email, senha: t.senha })
        .expect(200);

      // Bot com credenciais erradas: mesmo assim recebe "sucesso".
      const bot = await ctx.api
        .post('/auth/login')
        .send({
          email: t.email,
          senha: 'Qualquer@123',
          website: 'http://spam.example',
        })
        .expect(200);

      expect(Object.keys(bot.body).sort()).toEqual(
        Object.keys(real.body).sort(),
      );
      expect(Object.keys(bot.body.usuario).sort()).toEqual(
        Object.keys(real.body.usuario).sort(),
      );
      expect(bot.body.usuario.email).toBe(t.email);
      expect(bot.body.token.split('.')).toHaveLength(3);

      // Mesmos tipos de valor do login real, inclusive um nome plausível
      // (nome e sobrenome) em vez de vazio.
      for (const campo of Object.keys(real.body.usuario)) {
        expect(typeof bot.body.usuario[campo]).toBe(
          typeof real.body.usuario[campo],
        );
      }
      expect(bot.body.usuario.nome).toMatch(
        /^[A-ZÀ-Ú][a-zà-ú]+ [A-ZÀ-Ú][a-zà-ú]+$/,
      );

      // Como numa conta real, o mesmo e-mail devolve sempre o mesmo nome.
      const botDeNovo = await ctx.api
        .post('/auth/login')
        .send({ email: t.email, senha: 'Outra@123', website: 'x' })
        .expect(200);
      expect(botDeNovo.body.usuario.nome).toBe(bot.body.usuario.nome);
      expect(bot.headers['content-type']).toBe(real.headers['content-type']);
      expect(JSON.stringify(bot.body)).not.toMatch(/honeypot|bloque/i);

      await ctx.api.get('/aprendentes').set(bearer(bot.body.token)).expect(401);
    });

    it('cadastro com o campo honeypot preenchido responde 201 no mesmo formato do cadastro real, sem gravar nada nem enviar e-mail', async () => {
      const emailReal = emailUnico('real');
      const real = await ctx.api
        .post('/usuarios')
        .send({ nome: 'Pessoa Real', email: emailReal, senha: SENHA_PADRAO })
        .expect(201);

      const emailBot = emailUnico('visitante');
      const bot = await ctx.api
        .post('/usuarios')
        .send({
          nome: 'Visitante',
          email: emailBot,
          senha: SENHA_PADRAO,
          website: 'x',
        })
        .expect(201);

      expect(Object.keys(bot.body).sort()).toEqual(
        Object.keys(real.body).sort(),
      );
      expect(bot.body).toMatchObject({ nome: 'Visitante', email: emailBot });
      expect(JSON.stringify(bot.body)).not.toMatch(/honeypot|bloque|bot\b/i);

      expect(
        await ctx.prisma.usuario.count({ where: { email: emailBot } }),
      ).toBe(0);
      expect(ctx.email.ultimoToken('verificacao', emailBot)).toBeUndefined();

      // O e-mail usado pelo bot não fica "reservado": um humano pode se cadastrar com ele.
      await ctx.api
        .post('/usuarios')
        .send({ nome: 'Humano', email: emailBot, senha: SENHA_PADRAO })
        .expect(201);
    });
  });
});
