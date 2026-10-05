import { execSync } from 'child_process';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { resolverBancoTeste } from './banco-teste';

// Executa uma vez antes de todas as suítes: garante que o banco de teste
// existe e está com todas as migrations aplicadas (prisma migrate deploy).
export default async function globalSetup(): Promise<void> {
  const { url, nomeBanco } = resolverBancoTeste();

  await criarBancoSeNaoExistir(url, nomeBanco);

  const saida = execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '..', '..'),
    env: { ...process.env, DATABASE_URL: url },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Confere na própria saída do Prisma em qual banco as migrations rodaram.
  if (!saida.includes(`"${nomeBanco}"`)) {
    throw new Error(
      `[e2e] ABORTADO: prisma migrate deploy não confirmou o banco "${nomeBanco}".\n${saida}`,
    );
  }
}

// Conecta no banco de manutenção "postgres" do MESMO servidor local apenas
// para criar o banco de teste na primeira execução.
async function criarBancoSeNaoExistir(
  url: string,
  nomeBanco: string,
): Promise<void> {
  const urlManutencao = new URL(url);
  urlManutencao.pathname = '/postgres';
  urlManutencao.search = '';

  const prisma = new PrismaClient({ datasourceUrl: urlManutencao.toString() });
  try {
    const existentes = await prisma.$queryRaw<{ datname: string }[]>`
      SELECT datname FROM pg_database WHERE datname = ${nomeBanco}`;
    if (existentes.length === 0) {
      // Identificador não aceita parâmetro; o nome já foi validado (_test).
      await prisma.$executeRawUnsafe(
        `CREATE DATABASE "${nomeBanco.replace(/"/g, '""')}"`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}
