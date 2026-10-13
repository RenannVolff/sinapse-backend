// Dados de DEMONSTRAÇÃO (apresentação do TCC). Uso e cuidados em DEPLOY.md.
//
//   CONFIRMO_SEED=sim SEED_EMAIL=... SEED_SENHA=... DATABASE_URL="..." \
//     npx ts-node scripts/seed-demo.ts
//
// Idempotente: se o e-mail já existe, não grava nada. Tudo é criado num
// único create aninhado, então ou entra tudo ou nada.

import { FaseAtendimento, PrismaClient, StatusAtendimento } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUsuarioDto } from '../src/modules/usuarios/dto/create-usuario.dto';

// Mesmo custo do bcrypt usado no cadastro (UsuariosService.create).
const BCRYPT_SALT_ROUNDS = 10;
const TENTATIVAS_POR_ATIVIDADE = 5;
const DIA_MS = 24 * 60 * 60 * 1000;

function abortar(mensagem: string): never {
  console.error(`\n[seed-demo] ABORTADO: ${mensagem}\n`);
  process.exit(1);
}

// Acertos (de 5) por sessão em cada atividade: estáveis/baixos na linha de
// base e subindo na intervenção, para o gráfico A-B mostrar a mudança.
interface PerfilAprendente {
  nomeCompleto: string;
  dataNascimento: Date;
  responsavel: string;
  contato: string;
  atividades: { titulo: string; nivelDificuldade: number }[];
  acertos: { fase: FaseAtendimento; porAtividade: number[] }[];
}

// Nomes e contatos FICTÍCIOS.
const APRENDENTES: PerfilAprendente[] = [
  {
    nomeCompleto: 'Lucas Fictício Andrade',
    dataNascimento: new Date('2017-03-14'),
    responsavel: 'Mariana Fictícia Andrade',
    contato: '(00) 90000-0001',
    atividades: [
      { titulo: 'Coordenação Motora - Pinça', nivelDificuldade: 1 },
      { titulo: 'Consciência Fonológica - Rimas', nivelDificuldade: 2 },
    ],
    acertos: [
      { fase: 'LINHA_BASE', porAtividade: [1, 1] },
      { fase: 'LINHA_BASE', porAtividade: [2, 1] },
      { fase: 'LINHA_BASE', porAtividade: [1, 2] },
      { fase: 'LINHA_BASE', porAtividade: [2, 1] },
      { fase: 'INTERVENCAO', porAtividade: [3, 2] },
      { fase: 'INTERVENCAO', porAtividade: [3, 3] },
      { fase: 'INTERVENCAO', porAtividade: [4, 3] },
      { fase: 'INTERVENCAO', porAtividade: [5, 4] },
    ],
  },
  {
    nomeCompleto: 'Helena Fictícia Moraes',
    dataNascimento: new Date('2015-09-02'),
    responsavel: 'Roberto Fictício Moraes',
    contato: '(00) 90000-0002',
    atividades: [
      { titulo: 'Atenção Sustentada - Busca Visual', nivelDificuldade: 2 },
      { titulo: 'Raciocínio Lógico - Sequências', nivelDificuldade: 3 },
    ],
    acertos: [
      { fase: 'LINHA_BASE', porAtividade: [2, 1] },
      { fase: 'LINHA_BASE', porAtividade: [2, 2] },
      { fase: 'LINHA_BASE', porAtividade: [3, 1] },
      { fase: 'INTERVENCAO', porAtividade: [3, 2] },
      { fase: 'INTERVENCAO', porAtividade: [3, 3] },
      { fase: 'INTERVENCAO', porAtividade: [4, 3] },
      { fase: 'INTERVENCAO', porAtividade: [4, 4] },
      { fase: 'INTERVENCAO', porAtividade: [5, 4] },
    ],
  },
];

// Sessões semanais, às 14h, terminando na semana passada.
function dataSessao(indice: number, total: number): Date {
  const data = new Date(Date.now() - (total - indice) * 7 * DIA_MS);
  data.setHours(14, 0, 0, 0);
  return data;
}

function montarAprendente(perfil: PerfilAprendente) {
  const total = perfil.acertos.length;
  return {
    nomeCompleto: perfil.nomeCompleto,
    dataNascimento: perfil.dataNascimento,
    responsavel: perfil.responsavel,
    contato: perfil.contato,
    faseAtual: perfil.acertos[total - 1].fase,
    atendimentos: {
      create: perfil.acertos.map((sessao, i) => ({
        dataAtendimento: dataSessao(i, total),
        duracaoMinutos: 50,
        tituloSessao: `Sessão ${i + 1}`,
        observacoes:
          sessao.fase === 'LINHA_BASE'
            ? 'Registro de linha de base, sem intervenção direcionada.'
            : 'Intervenção conforme o PEI, com apoio visual.',
        status: StatusAtendimento.CONCLUIDO,
        concluido: true,
        fase: sessao.fase,
        atividades: {
          create: perfil.atividades.map((ativ, a) => ({
            titulo: ativ.titulo,
            nivelDificuldade: ativ.nivelDificuldade,
            itensChecklist: {
              create: Array.from(
                { length: TENTATIVAS_POR_ATIVIDADE },
                (_, t) => ({
                  descricao: `Tentativa ${t + 1}`,
                  realizado: t < sessao.porAtividade[a],
                }),
              ),
            },
          })),
        },
      })),
    },
  };
}

async function main() {
  if (process.env.CONFIRMO_SEED !== 'sim') {
    abortar(
      'defina CONFIRMO_SEED=sim para confirmar que quer gravar dados de demonstração.',
    );
  }

  const url = process.env.DATABASE_URL?.trim();
  if (!url) abortar('DATABASE_URL não definida.');
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    abortar('DATABASE_URL não é uma URL válida.');
  }

  const email = process.env.SEED_EMAIL?.trim();
  const senha = process.env.SEED_SENHA;
  if (!email || !senha) abortar('defina SEED_EMAIL e SEED_SENHA.');

  // Mesma validação do cadastro (e-mail válido + regra @SenhaForte).
  const dto = plainToInstance(CreateUsuarioDto, {
    nome: 'Terapeuta Demonstração',
    email,
    senha,
  });
  const erros = await validate(dto);
  if (erros.length > 0) {
    const mensagens = erros.flatMap((e) => Object.values(e.constraints ?? {}));
    abortar(`dados do usuário inválidos:\n  - ${mensagens.join('\n  - ')}`);
  }

  // Só o host, nunca a URL completa (contém a senha do banco).
  console.log(`[seed-demo] Banco de destino: ${host}`);

  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const existente = await prisma.usuario.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (existente) {
      console.warn(
        '[seed-demo] Usuário já existe neste banco — nada foi gravado.',
      );
      return;
    }

    const senhaHash = await bcrypt.hash(dto.senha, BCRYPT_SALT_ROUNDS);

    await prisma.usuario.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        senhaHash,
        emailVerificado: true,
        aprendentes: { create: APRENDENTES.map(montarAprendente) },
        peiTemplates: {
          create: {
            nome: 'Molde - Dificuldades de leitura (anos iniciais)',
            dificuldades:
              'Baixa consciência fonológica; dificuldade em segmentar sílabas e identificar rimas.',
            objetivos:
              'Identificar rimas em 4 de 5 tentativas; segmentar palavras dissílabas com autonomia.',
            estrategias:
              'Jogos de rima com apoio visual; segmentação com palmas; reforço positivo imediato.',
          },
        },
        tarefas: {
          create: [
            { texto: 'Preparar material da próxima sessão' },
            {
              texto: 'Revisar rascunho do relatório mensal',
              notas: 'Conferir a seção de frequência antes de exportar.',
            },
            { texto: 'Atualizar PEI após devolutiva à família', concluida: true },
          ],
        },
      },
    });

    const sessoes = APRENDENTES.reduce((s, a) => s + a.acertos.length, 0);
    console.log(
      `[seed-demo] Criado: 1 usuário (e-mail verificado), ${APRENDENTES.length} aprendentes, ` +
        `${sessoes} sessões concluídas, 1 molde de PEI e 3 tarefas.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro: unknown) => {
  const mensagem = erro instanceof Error ? erro.message : String(erro);
  abortar(mensagem);
});
