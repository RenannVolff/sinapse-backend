import { JwtService } from '@nestjs/jwt';
import { generate } from 'otplib';
import { AppTeste, criarAppTeste } from './helpers/app-teste';
import {
  bearer,
  criarTerapeuta,
  emailUnico,
  SENHA_PADRAO,
} from './helpers/fabrica';

describe('A. Autenticação', () => {
  let ctx: AppTeste;

  beforeAll(async () => {
    ctx = await criarAppTeste();
  });

  afterAll(async () => {
    await ctx.fechar();
  });

  describe('Cadastro e verificação de e-mail', () => {
    it('cadastra o terapeuta, bloqueia o login com 403 até verificar o e-mail, aceita o token recebido uma única vez e então libera o login', async () => {
      const email = emailUnico();

      const cadastro = await ctx.api
        .post('/usuarios')
        .send({ nome: 'Ana Terapeuta', email, senha: SENHA_PADRAO })
        .expect(201);
      expect(cadastro.body).toEqual({
        id: expect.any(String),
        nome: 'Ana Terapeuta',
        email,
        criadoEm: expect.any(String),
      });
      expect(cadastro.body).not.toHaveProperty('senhaHash');

      // No banco fica só o hash do token, nunca o valor enviado por e-mail.
      const token = ctx.email.ultimoToken('verificacao', email)!;
      expect(token).toMatch(/^[0-9a-f]{64}$/);
      const noBanco = await ctx.prisma.usuario.findUniqueOrThrow({
        where: { email },
      });
      expect(noBanco.emailVerificado).toBe(false);
      expect(noBanco.tokenVerificacao).not.toBe(token);

      const loginAntes = await ctx.api
        .post('/auth/login')
        .send({ email, senha: SENHA_PADRAO })
        .expect(403);
      expect(loginAntes.body.message).toMatch(/Confirme seu e-mail/);
      expect(loginAntes.body).not.toHaveProperty('token');

      await ctx.api.get('/auth/verificar-email').query({ token }).expect(200);

      // Uso único: o mesmo link não vale uma segunda vez.
      await ctx.api.get('/auth/verificar-email').query({ token }).expect(400);

      const login = await ctx.api
        .post('/auth/login')
        .send({ email, senha: SENHA_PADRAO })
        .expect(200);
      expect(login.body.token).toEqual(expect.any(String));
      expect(login.body.usuario).toEqual({
        id: cadastro.body.id,
        nome: 'Ana Terapeuta',
        email,
        duploFatorAtivo: false,
      });

      await ctx.api
        .get('/aprendentes')
        .set(bearer(login.body.token))
        .expect(200);
    });

    it('rejeita token de verificação inexistente com 400', async () => {
      await ctx.api
        .get('/auth/verificar-email')
        .query({ token: 'f'.repeat(64) })
        .expect(400);
    });

    it.each([
      ['curta demais', 'Ab@1'],
      ['sem letra maiúscula', 'senhafraca@123'],
      ['sem letra minúscula', 'SENHAFRACA@123'],
      ['só letras minúsculas', 'senhafraca'],
    ])(
      'rejeita senha fraca (%s) no cadastro com 400 e não grava o usuário',
      async (_caso, senha) => {
        const email = emailUnico();
        const res = await ctx.api
          .post('/usuarios')
          .send({ nome: 'Senha Fraca', email, senha })
          .expect(400);
        expect(JSON.stringify(res.body.message)).toMatch(/senha/i);
        expect(await ctx.prisma.usuario.count({ where: { email } })).toBe(0);
        expect(ctx.email.ultimoToken('verificacao', email)).toBeUndefined();
      },
    );

    it('rejeita cadastro com e-mail já existente com 409', async () => {
      const existente = await criarTerapeuta(ctx);
      await ctx.api
        .post('/usuarios')
        .send({
          nome: 'Duplicado',
          email: existente.email,
          senha: SENHA_PADRAO,
        })
        .expect(409);
    });

    it('recusa senha errada com 401 e a mesma mensagem de usuário inexistente', async () => {
      const terapeuta = await criarTerapeuta(ctx);
      const senhaErrada = await ctx.api
        .post('/auth/login')
        .send({ email: terapeuta.email, senha: 'OutraSenha@999' })
        .expect(401);
      const inexistente = await ctx.api
        .post('/auth/login')
        .send({ email: emailUnico('fantasma'), senha: SENHA_PADRAO })
        .expect(401);
      expect(senhaErrada.body.message).toBe(inexistente.body.message);
    });
  });

  describe('Proteção das rotas por JWT', () => {
    let jwtTeste: JwtService;
    let terapeutaId: string;
    let tokenValido: string;

    beforeAll(async () => {
      const terapeuta = await criarTerapeuta(ctx);
      terapeutaId = terapeuta.id;
      tokenValido = terapeuta.token;
      // Mesmo segredo do app (JWT_SECRET da suíte, definido em test/setup).
      jwtTeste = new JwtService({ secret: process.env.JWT_SECRET });
    });

    it('aceita o JWT válido emitido pelo login (controle)', async () => {
      await ctx.api.get('/aprendentes').set(bearer(tokenValido)).expect(200);
    });

    it('responde 401 quando o JWT está ausente', async () => {
      await ctx.api.get('/aprendentes').expect(401);
    });

    it.each([
      ['texto qualquer', 'Bearer nao-e-um-jwt'],
      ['três partes inválidas', 'Bearer abc.def.ghi'],
      ['sem o prefixo Bearer', 'token-sem-bearer'],
      ['Bearer vazio', 'Bearer '],
    ])(
      'responde 401 quando o JWT está malformado (%s)',
      async (_caso, header) => {
        await ctx.api
          .get('/aprendentes')
          .set('Authorization', header)
          .expect(401);
      },
    );

    it('responde 401 quando o payload do JWT foi adulterado (assinatura não confere)', async () => {
      const [cabecalho, , assinatura] = tokenValido.split('.');
      const payloadForjado = Buffer.from(
        JSON.stringify({
          sub: '00000000-0000-0000-0000-000000000000',
          email: 'invasor@e2e.test',
          iat: Math.floor(Date.now() / 1000),
        }),
      ).toString('base64url');
      await ctx.api
        .get('/aprendentes')
        .set(bearer(`${cabecalho}.${payloadForjado}.${assinatura}`))
        .expect(401);
    });

    it('responde 401 quando o JWT foi assinado com outro segredo', async () => {
      const forjado = new JwtService({ secret: 'segredo-do-atacante' }).sign({
        sub: terapeutaId,
        email: 'x@e2e.test',
      });
      await ctx.api.get('/aprendentes').set(bearer(forjado)).expect(401);
    });

    it('responde 401 quando o JWT está expirado', async () => {
      const duasHorasAtras = Math.floor(Date.now() / 1000) - 2 * 60 * 60;
      const expirado = jwtTeste.sign(
        { sub: terapeutaId, email: 'x@e2e.test', iat: duasHorasAtras },
        { expiresIn: '1h' },
      );
      await ctx.api.get('/aprendentes').set(bearer(expirado)).expect(401);
    });

    it('responde 401 quando o JWT é válido mas o usuário não existe', async () => {
      const semUsuario = jwtTeste.sign({
        sub: '3f1c1b1e-0000-4000-8000-000000000000',
        email: 'removido@e2e.test',
      });
      await ctx.api.get('/aprendentes').set(bearer(semUsuario)).expect(401);
    });
  });

  describe('Recuperação de senha', () => {
    it('redefine a senha de ponta a ponta com token de uso único: senha antiga deixa de valer e a nova passa a valer', async () => {
      const terapeuta = await criarTerapeuta(ctx);
      const novaSenha = 'NovaSenha#2026';

      const pedido = await ctx.api
        .post('/auth/esqueci-senha')
        .send({ email: terapeuta.email })
        .expect(200);
      const token = ctx.email.ultimoToken(
        'recuperacao-senha',
        terapeuta.email,
      )!;
      expect(token).toMatch(/^[0-9a-f]{64}$/);

      await ctx.api
        .post('/auth/redefinir-senha')
        .send({ token, novaSenha })
        .expect(200);

      await ctx.api
        .post('/auth/login')
        .send({ email: terapeuta.email, senha: terapeuta.senha })
        .expect(401);
      await ctx.api
        .post('/auth/login')
        .send({ email: terapeuta.email, senha: novaSenha })
        .expect(200);

      // Uso único: o mesmo token não redefine a senha de novo.
      await ctx.api
        .post('/auth/redefinir-senha')
        .send({ token, novaSenha: 'Terceira#Senha1' })
        .expect(400);
      await ctx.api
        .post('/auth/login')
        .send({ email: terapeuta.email, senha: novaSenha })
        .expect(200);

      expect(pedido.body.mensagem).toEqual(expect.any(String));
    });

    it('responde a mesma mensagem para e-mail inexistente e não envia e-mail (sem enumeração de contas)', async () => {
      const terapeuta = await criarTerapeuta(ctx);
      const fantasma = emailUnico('fantasma');

      const existente = await ctx.api
        .post('/auth/esqueci-senha')
        .send({ email: terapeuta.email })
        .expect(200);
      const inexistente = await ctx.api
        .post('/auth/esqueci-senha')
        .send({ email: fantasma })
        .expect(200);

      expect(inexistente.body).toEqual(existente.body);
      expect(
        ctx.email.ultimoToken('recuperacao-senha', fantasma),
      ).toBeUndefined();
    });

    it('rejeita senha fraca na redefinição com 400 e mantém o token válido', async () => {
      const terapeuta = await criarTerapeuta(ctx);
      await ctx.api
        .post('/auth/esqueci-senha')
        .send({ email: terapeuta.email })
        .expect(200);
      const token = ctx.email.ultimoToken(
        'recuperacao-senha',
        terapeuta.email,
      )!;

      await ctx.api
        .post('/auth/redefinir-senha')
        .send({ token, novaSenha: 'fraca' })
        .expect(400);
      await ctx.api
        .post('/auth/redefinir-senha')
        .send({ token, novaSenha: 'AgoraForte@1' })
        .expect(200);
    });
  });

  describe('Autenticação em dois fatores (2FA)', () => {
    it('ativa o 2FA, exige login em duas etapas, aceita código de backup uma única vez e recusa o token temporário em rotas normais', async () => {
      const terapeuta = await criarTerapeuta(ctx);

      const gerado = await ctx.api
        .post('/auth/2fa/gerar')
        .set(bearer(terapeuta.token))
        .expect(200);
      const segredo: string = gerado.body.segredo;
      expect(gerado.body.qrCodeBase64).toMatch(/^data:image\/png;base64,/);

      // Código errado não ativa.
      const codigoAtual = await generate({ secret: segredo });
      const codigoErrado = String(
        (Number(codigoAtual) + 500_000) % 1_000_000,
      ).padStart(6, '0');
      await ctx.api
        .post('/auth/2fa/ativar')
        .set(bearer(terapeuta.token))
        .send({ codigo: codigoErrado })
        .expect(400);

      const ativacao = await ctx.api
        .post('/auth/2fa/ativar')
        .set(bearer(terapeuta.token))
        .send({ codigo: await generate({ secret: segredo }) })
        .expect(200);
      const codigosBackup: string[] = ativacao.body.codigosBackup;
      expect(codigosBackup).toHaveLength(8);

      // Etapa 1: a senha sozinha não emite sessão.
      const etapa1 = await ctx.api
        .post('/auth/login')
        .send({ email: terapeuta.email, senha: terapeuta.senha })
        .expect(200);
      expect(etapa1.body).toEqual({
        pendente2fa: true,
        tokenTemporario: expect.any(String),
      });

      // O token temporário não vale como sessão.
      await ctx.api
        .get('/aprendentes')
        .set(bearer(etapa1.body.tokenTemporario))
        .expect(401);

      // Código TOTP errado: 401.
      await ctx.api
        .post('/auth/2fa/verificar-login')
        .send({
          tokenTemporario: etapa1.body.tokenTemporario,
          codigo: 'XXXXXXXX',
        })
        .expect(401);

      // Etapa 2 com o código do app autenticador.
      const etapa2 = await ctx.api
        .post('/auth/2fa/verificar-login')
        .send({
          tokenTemporario: etapa1.body.tokenTemporario,
          codigo: await generate({ secret: segredo }),
        })
        .expect(200);
      expect(etapa2.body.usuario.duploFatorAtivo).toBe(true);
      await ctx.api
        .get('/aprendentes')
        .set(bearer(etapa2.body.token))
        .expect(200);

      // Código de backup: vale uma vez (aceita minúsculas e hífen)...
      const backup = codigosBackup[0];
      const backupDigitado =
        `${backup.slice(0, 4)}-${backup.slice(4)}`.toLowerCase();
      const login2 = await ctx.api
        .post('/auth/login')
        .send({ email: terapeuta.email, senha: terapeuta.senha })
        .expect(200);
      await ctx.api
        .post('/auth/2fa/verificar-login')
        .send({
          tokenTemporario: login2.body.tokenTemporario,
          codigo: backupDigitado,
        })
        .expect(200);

      // ...e é recusado na segunda.
      const login3 = await ctx.api
        .post('/auth/login')
        .send({ email: terapeuta.email, senha: terapeuta.senha })
        .expect(200);
      await ctx.api
        .post('/auth/2fa/verificar-login')
        .send({ tokenTemporario: login3.body.tokenTemporario, codigo: backup })
        .expect(401);

      // Os outros 7 códigos continuam válidos.
      await ctx.api
        .post('/auth/2fa/verificar-login')
        .send({
          tokenTemporario: login3.body.tokenTemporario,
          codigo: codigosBackup[1],
        })
        .expect(200);

      const noBanco = await ctx.prisma.usuario.findUniqueOrThrow({
        where: { id: terapeuta.id },
      });
      expect(noBanco.duploFatorCodigosBackup).toHaveLength(6);
      expect(noBanco.duploFatorCodigosBackup).not.toContain(backup);
    });

    it('recusa token temporário adulterado ou de outro tipo na etapa 2 com 401', async () => {
      const terapeuta = await criarTerapeuta(ctx);
      // O JWT de sessão comum não serve como token temporário.
      await ctx.api
        .post('/auth/2fa/verificar-login')
        .send({ tokenTemporario: terapeuta.token, codigo: '123456' })
        .expect(401);
      await ctx.api
        .post('/auth/2fa/verificar-login')
        .send({ tokenTemporario: 'abc.def.ghi', codigo: '123456' })
        .expect(401);
    });

    it('desativa o 2FA só com a senha correta (403 com senha errada)', async () => {
      const terapeuta = await criarTerapeuta(ctx);
      const gerado = await ctx.api
        .post('/auth/2fa/gerar')
        .set(bearer(terapeuta.token))
        .expect(200);
      await ctx.api
        .post('/auth/2fa/ativar')
        .set(bearer(terapeuta.token))
        .send({ codigo: await generate({ secret: gerado.body.segredo }) })
        .expect(200);

      await ctx.api
        .post('/auth/2fa/desativar')
        .set(bearer(terapeuta.token))
        .send({ senha: 'SenhaErrada@1' })
        .expect(403);
      await ctx.api
        .post('/auth/2fa/desativar')
        .set(bearer(terapeuta.token))
        .send({ senha: terapeuta.senha })
        .expect(200);

      const login = await ctx.api
        .post('/auth/login')
        .send({ email: terapeuta.email, senha: terapeuta.senha })
        .expect(200);
      expect(login.body.token).toEqual(expect.any(String));
      expect(login.body).not.toHaveProperty('pendente2fa');
    });
  });
});
