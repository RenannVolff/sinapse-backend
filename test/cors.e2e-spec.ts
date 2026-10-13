import { AppTeste, criarAppTeste } from './helpers/app-teste';

// FRONTEND_URL da suíte vem de test/setup/ambiente.ts; NODE_ENV=test, então
// o Vite local (localhost:5173) também é liberado.
const ORIGEM_PERMITIDA = 'http://localhost-e2e.invalid';
const ORIGEM_DEV = 'http://localhost:5173';
const ORIGEM_DESCONHECIDA = 'https://site-malicioso.invalid';

describe('F. CORS', () => {
  let ctx: AppTeste;

  beforeAll(async () => {
    ctx = await criarAppTeste();
  });

  afterAll(async () => {
    await ctx.fechar();
  });

  it.each([ORIGEM_PERMITIDA, ORIGEM_DEV])(
    'origem permitida (%s) recebe Access-Control-Allow-Origin',
    async (origem) => {
      const res = await ctx.api.get('/').set('Origin', origem);
      expect(res.headers['access-control-allow-origin']).toBe(origem);
    },
  );

  it('preflight de origem permitida libera o método', async () => {
    const res = await ctx.api
      .options('/aprendentes')
      .set('Origin', ORIGEM_PERMITIDA)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGEM_PERMITIDA);
  });

  it('origem desconhecida não recebe Access-Control-Allow-Origin', async () => {
    const simples = await ctx.api.get('/').set('Origin', ORIGEM_DESCONHECIDA);
    expect(simples.headers['access-control-allow-origin']).toBeUndefined();

    const preflight = await ctx.api
      .options('/aprendentes')
      .set('Origin', ORIGEM_DESCONHECIDA)
      .set('Access-Control-Request-Method', 'POST');
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });
});
