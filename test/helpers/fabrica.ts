import { AppTeste } from './app-teste';

// Fábricas que criam dados SEMPRE pela API (nunca direto no banco), para
// que cada cenário passe pelas mesmas validações que o frontend.

export const SENHA_PADRAO = 'SenhaForte@123';

export interface Terapeuta {
  id: string;
  nome: string;
  email: string;
  senha: string;
  token: string;
}

let contador = 0;

export function emailUnico(prefixo = 'terapeuta'): string {
  contador++;
  return `${prefixo}.${Date.now()}.${contador}@e2e.sinapse.test`;
}

// Fluxo completo: cadastro → verificação pelo token "recebido" → login.
export async function criarTerapeuta(
  ctx: AppTeste,
  dados: { nome?: string; email?: string; senha?: string } = {},
): Promise<Terapeuta> {
  const nome = dados.nome ?? 'Terapeuta E2E';
  const email = dados.email ?? emailUnico();
  const senha = dados.senha ?? SENHA_PADRAO;

  const cadastro = await ctx.api
    .post('/usuarios')
    .send({ nome, email, senha })
    .expect(201);

  const tokenVerificacao = ctx.email.ultimoToken('verificacao', email);
  if (!tokenVerificacao) throw new Error('E-mail de verificação não capturado');

  await ctx.api
    .get('/auth/verificar-email')
    .query({ token: tokenVerificacao })
    .expect(200);

  const login = await ctx.api
    .post('/auth/login')
    .send({ email, senha })
    .expect(200);

  return { id: cadastro.body.id, nome, email, senha, token: login.body.token };
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export async function criarAprendente(
  ctx: AppTeste,
  terapeuta: Terapeuta,
  dados: Partial<{ nomeCompleto: string; dataNascimento: string }> = {},
) {
  const res = await ctx.api
    .post('/aprendentes')
    .set(bearer(terapeuta.token))
    .send({
      nomeCompleto: dados.nomeCompleto ?? 'Aprendente E2E',
      dataNascimento: dados.dataNascimento ?? '2016-03-10',
      responsavel: 'Responsável E2E',
      contato: '(41) 99999-0000',
    })
    .expect(201);
  return res.body as { id: string; nomeCompleto: string; faseAtual: string };
}

// Datas sempre no futuro (o DTO recusa agendamento no passado):
// `horarioFuturo(dia, hora)` é o dia `dia` de janeiro de daqui a dois anos (UTC).
const ANO_BASE = new Date().getUTCFullYear() + 2;
export function horarioFuturo(dia: number, hora: number, minuto = 0): string {
  return new Date(Date.UTC(ANO_BASE, 0, dia, hora, minuto)).toISOString();
}

export async function criarAtendimento(
  ctx: AppTeste,
  terapeuta: Terapeuta,
  aprendenteId: string,
  dados: Partial<{
    dataAtendimento: string;
    duracaoMinutos: number;
    tituloSessao: string;
    fase: string;
  }> = {},
) {
  const res = await ctx.api
    .post('/atendimentos')
    .set(bearer(terapeuta.token))
    .send({
      aprendenteId,
      dataAtendimento: dados.dataAtendimento ?? horarioFuturo(1, 13),
      duracaoMinutos: dados.duracaoMinutos ?? 60,
      tituloSessao: dados.tituloSessao ?? 'Sessão E2E',
      ...(dados.fase ? { fase: dados.fase } : {}),
    })
    .expect(201);
  return res.body as {
    id: string;
    status: string;
    fase: string;
    dataAtendimento: string;
  };
}
