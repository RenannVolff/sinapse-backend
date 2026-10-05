import { NotFoundException } from '@nestjs/common';
import { StatusAtendimento } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RelatoriosService } from './relatorios.service';

const USUARIO_ID = 'usuario-1';
const APRENDENTE_ID = 'aprendente-1';

interface AtendimentoFake {
  aprendenteId: string;
  dataAtendimento: Date;
  status: StatusAtendimento;
  deletedAt: Date | null;
}

// Prisma mockado. O count aplica o `where` recebido sobre a lista em memória
// (status igual/diferente, data anterior a, deletedAt nulo), para que o teste
// valide os filtros montados pelo serviço e não só a aritmética final.
function criarPrismaMock(atendimentos: AtendimentoFake[]) {
  return {
    aprendente: {
      findFirst: jest.fn().mockResolvedValue({ id: APRENDENTE_ID }),
    },
    atendimento: {
      count: jest.fn().mockImplementation(({ where }) =>
        Promise.resolve(
          atendimentos.filter((a) => {
            if (where.aprendenteId && a.aprendenteId !== where.aprendenteId)
              return false;
            if (where.deletedAt === null && a.deletedAt) return false;
            if (typeof where.status === 'string' && a.status !== where.status)
              return false;
            if (where.status?.not && a.status === where.status.not)
              return false;
            if (
              where.dataAtendimento?.lt &&
              !(a.dataAtendimento < where.dataAtendimento.lt)
            )
              return false;
            return true;
          }).length,
        ),
      ),
    },
  };
}

function sessao(
  status: StatusAtendimento,
  diasAPartirDeHoje: number,
  deletedAt: Date | null = null,
): AtendimentoFake {
  const data = new Date();
  data.setDate(data.getDate() + diasAPartirDeHoje);
  return {
    aprendenteId: APRENDENTE_ID,
    dataAtendimento: data,
    status,
    deletedAt,
  };
}

// Cenário de referência: 3 concluídas, 1 falta, 1 cancelada no passado
// e 2 futuras ainda sem desfecho.
const cenarioReferencia: AtendimentoFake[] = [
  sessao(StatusAtendimento.CONCLUIDO, -30),
  sessao(StatusAtendimento.CONCLUIDO, -20),
  sessao(StatusAtendimento.CONCLUIDO, -10),
  sessao(StatusAtendimento.FALTA, -15),
  sessao(StatusAtendimento.CANCELADO, -5),
  sessao(StatusAtendimento.AGENDADO, 7),
  sessao(StatusAtendimento.CONFIRMADO, 14),
];

describe('RelatoriosService.getTaxaFrequencia', () => {
  it('calcula 4 sessões esperadas e absenteísmo de 25% no cenário de referência', async () => {
    const servico = new RelatoriosService(
      criarPrismaMock(cenarioReferencia) as unknown as PrismaService,
    );

    const resultado = await servico.getTaxaFrequencia(
      APRENDENTE_ID,
      USUARIO_ID,
    );

    expect(resultado).toEqual({
      aprendenteId: APRENDENTE_ID,
      totalAgendadas: 4,
      totalConcluidas: 3,
      totalFaltas: 1,
      totalCancelados: 1,
      taxaAbsenteismo: 25,
      taxaFrequencia: 75,
    });
  });

  it('ignora sessões canceladas no denominador da frequência', async () => {
    const semCancelada = cenarioReferencia.filter(
      (a) => a.status !== StatusAtendimento.CANCELADO,
    );
    const servicoCom = new RelatoriosService(
      criarPrismaMock(cenarioReferencia) as unknown as PrismaService,
    );
    const servicoSem = new RelatoriosService(
      criarPrismaMock(semCancelada) as unknown as PrismaService,
    );

    const com = await servicoCom.getTaxaFrequencia(APRENDENTE_ID, USUARIO_ID);
    const sem = await servicoSem.getTaxaFrequencia(APRENDENTE_ID, USUARIO_ID);

    expect(com.totalAgendadas).toBe(sem.totalAgendadas);
    expect(com.taxaAbsenteismo).toBe(sem.taxaAbsenteismo);
  });

  it('ignora sessões futuras no denominador da frequência', async () => {
    const prisma = criarPrismaMock(cenarioReferencia);
    const servico = new RelatoriosService(prisma as unknown as PrismaService);

    await servico.getTaxaFrequencia(APRENDENTE_ID, USUARIO_ID);

    const whereDenominador = prisma.atendimento.count.mock.calls[0][0].where;
    expect(whereDenominador.dataAtendimento.lt).toBeInstanceOf(Date);
    expect(whereDenominador.status).toEqual({
      not: StatusAtendimento.CANCELADO,
    });
  });

  it('ignora sessões excluídas (soft delete) em todas as contagens', async () => {
    const servico = new RelatoriosService(
      criarPrismaMock([
        ...cenarioReferencia,
        sessao(StatusAtendimento.FALTA, -3, new Date()),
      ]) as unknown as PrismaService,
    );

    const resultado = await servico.getTaxaFrequencia(
      APRENDENTE_ID,
      USUARIO_ID,
    );

    expect(resultado.totalFaltas).toBe(1);
    expect(resultado.totalAgendadas).toBe(4);
  });

  it('retorna absenteísmo 0 e frequência 100 sem nenhuma sessão, sem dividir por zero', async () => {
    const servico = new RelatoriosService(
      criarPrismaMock([]) as unknown as PrismaService,
    );

    const resultado = await servico.getTaxaFrequencia(
      APRENDENTE_ID,
      USUARIO_ID,
    );

    expect(resultado.totalAgendadas).toBe(0);
    expect(resultado.taxaAbsenteismo).toBe(0);
    expect(resultado.taxaFrequencia).toBe(100);
    expect(Number.isFinite(resultado.taxaAbsenteismo)).toBe(true);
  });

  it('lança 404 quando o aprendente não pertence ao terapeuta logado', async () => {
    const prisma = criarPrismaMock(cenarioReferencia);
    prisma.aprendente.findFirst.mockResolvedValue(null);
    const servico = new RelatoriosService(prisma as unknown as PrismaService);

    await expect(
      servico.getTaxaFrequencia(APRENDENTE_ID, 'outro-usuario'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.aprendente.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: APRENDENTE_ID,
          usuarioId: 'outro-usuario',
          deletedAt: null,
        },
      }),
    );
    expect(prisma.atendimento.count).not.toHaveBeenCalled();
  });
});
