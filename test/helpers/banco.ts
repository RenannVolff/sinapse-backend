import { PrismaService } from '../../src/prisma/prisma.service';
import { resolverBancoTeste } from '../setup/banco-teste';

// Ordem irrelevante por causa do CASCADE; listadas todas para nenhuma suíte
// herdar dados de outra.
const TABELAS = [
  'itens_checklist',
  'atividades',
  'atendimentos',
  'peis',
  'pei_templates',
  'tarefas',
  'aprendentes',
  'usuarios',
  'audit_logs',
];

// Segunda trava (a primeira é o nome na URL): pergunta ao PRÓPRIO Postgres
// em qual banco a conexão do app está antes de apagar qualquer coisa.
export async function limparBanco(prisma: PrismaService): Promise<void> {
  const { nomeBanco } = resolverBancoTeste();
  const [{ current_database: bancoConectado }] = await prisma.$queryRaw<
    { current_database: string }[]
  >`SELECT current_database()`;

  if (bancoConectado !== nomeBanco || !bancoConectado.endsWith('_test')) {
    throw new Error(
      `[e2e] ABORTADO: o app está conectado em "${bancoConectado}", não no banco de teste "${nomeBanco}". Nenhuma tabela foi limpa.`,
    );
  }

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABELAS.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}
