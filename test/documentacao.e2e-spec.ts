import type { OpenAPIObject } from '@nestjs/swagger';
import { criarDocumentoSwagger } from '../src/swagger';
import { AppTeste, criarAppTeste } from './helpers/app-teste';

// Únicas rotas sem @ApiBearerAuth: as marcadas com @IsPublic().
const OPERACOES_PUBLICAS = [
  'POST /auth/login',
  'GET /auth/verificar-email',
  'POST /auth/reenviar-verificacao',
  'POST /auth/esqueci-senha',
  'POST /auth/redefinir-senha',
  'POST /auth/2fa/verificar-login',
  'POST /usuarios',
  'GET /health',
].sort();

const METODOS = ['get', 'post', 'put', 'patch', 'delete'] as const;

interface Operacao {
  chave: string;
  security?: Record<string, string[]>[];
  tags?: string[];
}

function listarOperacoes(documento: OpenAPIObject): Operacao[] {
  return Object.entries(documento.paths).flatMap(([caminho, item]) =>
    METODOS.filter((metodo) => item[metodo]).map((metodo) => ({
      // /aprendentes/{id} -> /aprendentes/:id, igual à notação das rotas Nest
      chave: `${metodo.toUpperCase()} ${caminho.replace(/\{(\w+)\}/g, ':$1')}`,
      security: item[metodo]!.security,
      tags: item[metodo]!.tags,
    })),
  );
}

const exigeBearer = (op: Operacao) =>
  (op.security ?? []).some((requisito) => 'bearer' in requisito);

describe('G. Documentação (Swagger) e health check', () => {
  let ctx: AppTeste;
  let documento: OpenAPIObject;
  let operacoes: Operacao[];

  beforeAll(async () => {
    ctx = await criarAppTeste();
    documento = criarDocumentoSwagger(ctx.app);
    operacoes = listarOperacoes(documento);
  });

  afterAll(async () => {
    await ctx.fechar();
  });

  it('declara o esquema de segurança bearer (JWT)', () => {
    expect(documento.components?.securitySchemes?.bearer).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('toda operação fora da lista pública exige bearer', () => {
    const semBearer = operacoes
      .filter((op) => !OPERACOES_PUBLICAS.includes(op.chave))
      .filter((op) => !exigeBearer(op))
      .map((op) => op.chave);
    expect(semBearer).toEqual([]);
  });

  it('as operações sem segurança são exatamente as rotas públicas', () => {
    const publicas = operacoes
      .filter((op) => !op.security?.length)
      .map((op) => op.chave)
      .sort();
    expect(publicas).toEqual(OPERACOES_PUBLICAS);
  });

  it('toda tag usada nos controllers está declarada no DocumentBuilder', () => {
    const declaradas = new Set((documento.tags ?? []).map((t) => t.name));
    const usadas = new Set(operacoes.flatMap((op) => op.tags ?? []));
    expect([...usadas].filter((tag) => !declaradas.has(tag))).toEqual([]);
    expect([...declaradas].filter((tag) => !usadas.has(tag))).toEqual([]);
  });

  it('o campo honeypot não aparece na documentação', () => {
    const schemas = documento.components?.schemas ?? {};
    for (const nome of ['LoginDto', 'CreateUsuarioDto']) {
      const schema = schemas[nome] as { properties?: Record<string, unknown> };
      expect(schema?.properties).toBeDefined();
      expect(schema.properties).not.toHaveProperty('website');
    }
  });

  it('GET /health responde 200 sem token', async () => {
    const res = await ctx.api.get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
