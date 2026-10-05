import * as fs from 'fs';
import * as path from 'path';

// Trava de segurança compartilhada pelo globalSetup e por cada worker do
// Jest: a suíte e2e só roda contra um Postgres LOCAL cujo banco termine em
// `_test`. Qualquer outra coisa (sinapse_db, Neon, banco remoto) aborta antes
// de o app subir ou de qualquer tabela ser limpa.

const ARQUIVO_ENV_TEST = path.resolve(__dirname, '..', '..', '.env.test');
const HOSTS_LOCAIS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export interface BancoTeste {
  url: string;
  nomeBanco: string;
}

function lerDoArquivoEnvTest(): string | undefined {
  if (!fs.existsSync(ARQUIVO_ENV_TEST)) return undefined;
  const conteudo = fs.readFileSync(ARQUIVO_ENV_TEST, 'utf8');
  const linha = conteudo.match(/^\s*DATABASE_URL_TEST\s*=\s*(.+)\s*$/m);
  return linha?.[1].trim().replace(/^["']|["']$/g, '');
}

function abortar(motivo: string): never {
  throw new Error(`\n[e2e] ABORTADO: ${motivo}\n`);
}

export function resolverBancoTeste(): BancoTeste {
  const url = process.env.DATABASE_URL_TEST?.trim() || lerDoArquivoEnvTest();
  if (!url) {
    abortar(
      'DATABASE_URL_TEST não definida. Defina a variável de ambiente ou crie ' +
        'o arquivo .env.test (veja .env.test.example).',
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    abortar('DATABASE_URL_TEST não é uma URL válida.');
  }

  // O nome do banco é o path da URL, sem os parâmetros (?schema=public).
  const nomeBanco = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!nomeBanco.endsWith('_test')) {
    abortar(
      `o banco da DATABASE_URL_TEST ("${nomeBanco}") não termina em _test.`,
    );
  }

  if (!HOSTS_LOCAIS.has(parsed.hostname)) {
    abortar(
      `a DATABASE_URL_TEST aponta para "${parsed.hostname}"; a suíte e2e só ` +
        'roda contra o Postgres local.',
    );
  }

  return { url, nomeBanco };
}
