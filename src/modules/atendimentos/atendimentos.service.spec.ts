import { BadRequestException } from '@nestjs/common';
import { StatusAtendimento } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AtendimentosService } from './atendimentos.service';

const USUARIO_ID = 'usuario-1';
const APRENDENTE_ID = 'aprendente-1';
const MENSAGEM_CONFLITO = 'Já existe um atendimento agendado nesse horário.';

interface AtendimentoFake {
  id: string;
  dataAtendimento: Date;
  duracaoMinutos: number;
  status: StatusAtendimento;
  deletedAt: Date | null;
}

// Prisma mockado. O findMany aplica o mesmo filtro que o banco aplicaria
// (status, deletedAt, janela de datas e id ignorado), para que o teste
// exercite o `where` montado pelo serviço e não apenas um retorno fixo.
function criarPrismaMock(existentes: AtendimentoFake[] = []) {
  return {
    aprendente: {
      findFirst: jest.fn().mockResolvedValue({
        id: APRENDENTE_ID,
        usuarioId: USUARIO_ID,
        faseAtual: 'LINHA_BASE',
      }),
    },
    atendimento: {
      findMany: jest.fn().mockImplementation(({ where }) =>
        Promise.resolve(
          existentes
            .filter((a) => (where.deletedAt === null ? !a.deletedAt : true))
            .filter((a) =>
              where.status?.not ? a.status !== where.status.not : true,
            )
            .filter((a) => (where.id?.not ? a.id !== where.id.not : true))
            .filter(
              (a) =>
                a.dataAtendimento >= where.dataAtendimento.gte &&
                a.dataAtendimento < where.dataAtendimento.lt,
            )
            .map(({ dataAtendimento, duracaoMinutos }) => ({
              dataAtendimento,
              duracaoMinutos,
            })),
        ),
      ),
      findFirst: jest.fn(),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'novo', ...data }),
        ),
      update: jest
        .fn()
        .mockImplementation(({ where, data }) =>
          Promise.resolve({ id: where.id, ...data }),
        ),
    },
  };
}

function criarServico(prisma: ReturnType<typeof criarPrismaMock>) {
  return new AtendimentosService(prisma as unknown as PrismaService);
}

// Sessão existente das 10:00 às 11:00.
const existente10as11: AtendimentoFake = {
  id: 'existente',
  dataAtendimento: new Date('2030-03-10T10:00:00.000Z'),
  duracaoMinutos: 60,
  status: StatusAtendimento.CONFIRMADO,
  deletedAt: null,
};

function novoAtendimento(dataISO: string, duracaoMinutos = 60) {
  return {
    aprendenteId: APRENDENTE_ID,
    tituloSessao: 'Sessão',
    dataAtendimento: dataISO,
    duracaoMinutos,
  };
}

describe('AtendimentosService - conflito de horário na criação', () => {
  it('cria o atendimento quando não há sobreposição de horário', async () => {
    const prisma = criarPrismaMock([existente10as11]);
    const servico = criarServico(prisma);

    await servico.create(
      novoAtendimento('2030-03-10T14:00:00.000Z'),
      USUARIO_ID,
    );

    expect(prisma.atendimento.create).toHaveBeenCalledTimes(1);
  });

  it('rejeita com 400 e mensagem de conflito quando há sobreposição parcial', async () => {
    const prisma = criarPrismaMock([existente10as11]);
    const servico = criarServico(prisma);

    const promessa = servico.create(
      novoAtendimento('2030-03-10T10:30:00.000Z'),
      USUARIO_ID,
    );

    await expect(promessa).rejects.toBeInstanceOf(BadRequestException);
    await expect(promessa).rejects.toMatchObject({
      status: 400,
      message: MENSAGEM_CONFLITO,
    });
    expect(prisma.atendimento.create).not.toHaveBeenCalled();
  });

  it('rejeita quando o novo atendimento começa antes e termina durante o existente', async () => {
    const prisma = criarPrismaMock([existente10as11]);
    const servico = criarServico(prisma);

    await expect(
      servico.create(novoAtendimento('2030-03-10T09:30:00.000Z'), USUARIO_ID),
    ).rejects.toThrow(MENSAGEM_CONFLITO);
  });

  it('rejeita quando o novo atendimento fica totalmente dentro do existente', async () => {
    const prisma = criarPrismaMock([existente10as11]);
    const servico = criarServico(prisma);

    await expect(
      servico.create(
        novoAtendimento('2030-03-10T10:15:00.000Z', 30),
        USUARIO_ID,
      ),
    ).rejects.toThrow(MENSAGEM_CONFLITO);
  });

  it('permite horário encostando: começa exatamente quando o existente termina', async () => {
    const prisma = criarPrismaMock([existente10as11]);
    const servico = criarServico(prisma);

    await servico.create(
      novoAtendimento('2030-03-10T11:00:00.000Z'),
      USUARIO_ID,
    );

    expect(prisma.atendimento.create).toHaveBeenCalledTimes(1);
  });

  it('permite horário encostando: termina exatamente quando o existente começa', async () => {
    const prisma = criarPrismaMock([existente10as11]);
    const servico = criarServico(prisma);

    await servico.create(
      novoAtendimento('2030-03-10T09:00:00.000Z'),
      USUARIO_ID,
    );

    expect(prisma.atendimento.create).toHaveBeenCalledTimes(1);
  });

  it('não considera conflito com atendimento CANCELADO no mesmo horário', async () => {
    const prisma = criarPrismaMock([
      { ...existente10as11, status: StatusAtendimento.CANCELADO },
    ]);
    const servico = criarServico(prisma);

    await servico.create(
      novoAtendimento('2030-03-10T10:00:00.000Z'),
      USUARIO_ID,
    );

    expect(prisma.atendimento.create).toHaveBeenCalledTimes(1);
  });

  it('não considera conflito com atendimento excluído (soft delete) no mesmo horário', async () => {
    const prisma = criarPrismaMock([
      { ...existente10as11, deletedAt: new Date('2030-03-01T00:00:00.000Z') },
    ]);
    const servico = criarServico(prisma);

    await servico.create(
      novoAtendimento('2030-03-10T10:00:00.000Z'),
      USUARIO_ID,
    );

    expect(prisma.atendimento.create).toHaveBeenCalledTimes(1);
  });

  it('envia ao Prisma a exclusão de CANCELADO e de deletedAt, filtrando pelo terapeuta logado', async () => {
    const prisma = criarPrismaMock();
    const servico = criarServico(prisma);

    await servico.create(
      novoAtendimento('2030-03-10T10:00:00.000Z', 45),
      USUARIO_ID,
    );

    const { where } = prisma.atendimento.findMany.mock.calls[0][0];
    expect(where).toMatchObject({
      aprendente: { usuarioId: USUARIO_ID },
      deletedAt: null,
      status: { not: StatusAtendimento.CANCELADO },
      dataAtendimento: {
        gte: new Date('2030-03-09T10:00:00.000Z'), // margem de 24h para trás
        lt: new Date('2030-03-10T10:45:00.000Z'), // fim do novo atendimento
      },
    });
    expect(where).not.toHaveProperty('id');
  });

  it('usa duração padrão de 60 minutos quando duracaoMinutos é omitido', async () => {
    const prisma = criarPrismaMock();
    const servico = criarServico(prisma);

    await servico.create(
      {
        aprendenteId: APRENDENTE_ID,
        tituloSessao: 'Sessão',
        dataAtendimento: '2030-03-10T10:00:00.000Z',
      },
      USUARIO_ID,
    );

    const { where } = prisma.atendimento.findMany.mock.calls[0][0];
    expect(where.dataAtendimento.lt).toEqual(
      new Date('2030-03-10T11:00:00.000Z'),
    );
    expect(prisma.atendimento.create.mock.calls[0][0].data.duracaoMinutos).toBe(
      60,
    );
  });
});

describe('AtendimentosService - conflito de horário na edição', () => {
  function prismaComAtual(
    atual: AtendimentoFake,
    outros: AtendimentoFake[] = [],
  ) {
    const prisma = criarPrismaMock([atual, ...outros]);
    prisma.atendimento.findFirst.mockResolvedValue({
      ...atual,
      aprendente: { nomeCompleto: 'Aprendente' },
      atividades: [],
    });
    return prisma;
  }

  const atual: AtendimentoFake = {
    ...existente10as11,
    id: 'atual',
  };

  it('ignora o próprio atendimento na checagem (ignorarId) ao alterar a duração', async () => {
    const prisma = prismaComAtual(atual);
    const servico = criarServico(prisma);

    await servico.update('atual', { duracaoMinutos: 90 }, USUARIO_ID);

    const { where } = prisma.atendimento.findMany.mock.calls[0][0];
    expect(where.id).toEqual({ not: 'atual' });
    expect(prisma.atendimento.update).toHaveBeenCalledTimes(1);
  });

  it('usa a data atual do atendimento quando o payload traz só duracaoMinutos', async () => {
    const prisma = prismaComAtual(atual);
    const servico = criarServico(prisma);

    await servico.update('atual', { duracaoMinutos: 30 }, USUARIO_ID);

    const { where } = prisma.atendimento.findMany.mock.calls[0][0];
    expect(where.dataAtendimento.lt).toEqual(
      new Date('2030-03-10T10:30:00.000Z'),
    );
  });

  it('rejeita a edição que passa a sobrepor outro atendimento', async () => {
    const outro: AtendimentoFake = {
      ...existente10as11,
      id: 'outro',
      dataAtendimento: new Date('2030-03-10T11:30:00.000Z'),
    };
    const prisma = prismaComAtual(atual, [outro]);
    const servico = criarServico(prisma);

    await expect(
      servico.update('atual', { duracaoMinutos: 120 }, USUARIO_ID),
    ).rejects.toMatchObject({ status: 400, message: MENSAGEM_CONFLITO });
    expect(prisma.atendimento.update).not.toHaveBeenCalled();
  });

  it('executa a checagem quando o payload traz dataAtendimento', async () => {
    const prisma = prismaComAtual(atual);
    const servico = criarServico(prisma);

    await servico.update(
      'atual',
      { dataAtendimento: '2030-03-11T10:00:00.000Z' },
      USUARIO_ID,
    );

    expect(prisma.atendimento.findMany).toHaveBeenCalledTimes(1);
  });

  it('não executa a checagem quando o payload não traz dataAtendimento nem duracaoMinutos', async () => {
    const prisma = prismaComAtual(atual);
    const servico = criarServico(prisma);

    await servico.update(
      'atual',
      { tituloSessao: 'Novo título', observacoes: 'obs' },
      USUARIO_ID,
    );

    expect(prisma.atendimento.findMany).not.toHaveBeenCalled();
    expect(prisma.atendimento.update).toHaveBeenCalledTimes(1);
  });

  it('pula a checagem quando a edição deixa o atendimento CANCELADO, mesmo em horário ocupado', async () => {
    const outro: AtendimentoFake = {
      ...existente10as11,
      id: 'outro',
      dataAtendimento: new Date('2030-03-12T10:00:00.000Z'),
    };
    const prisma = prismaComAtual(atual, [outro]);
    const servico = criarServico(prisma);

    await servico.update(
      'atual',
      {
        dataAtendimento: '2030-03-12T10:00:00.000Z',
        status: StatusAtendimento.CANCELADO,
      },
      USUARIO_ID,
    );

    expect(prisma.atendimento.findMany).not.toHaveBeenCalled();
    expect(prisma.atendimento.update).toHaveBeenCalledTimes(1);
  });

  it('pula a checagem quando o atendimento já está CANCELADO e o payload não muda o status', async () => {
    const prisma = prismaComAtual({
      ...atual,
      status: StatusAtendimento.CANCELADO,
    });
    const servico = criarServico(prisma);

    await servico.update('atual', { duracaoMinutos: 90 }, USUARIO_ID);

    expect(prisma.atendimento.findMany).not.toHaveBeenCalled();
  });
});
