import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateAtendimentoDto {
  alunoId: string;
  dataAtendimento: string | Date;
  tituloSessao: string;
  observacoes?: string;
}

type UpdateAtendimentoDto = Partial<CreateAtendimentoDto>;

@Injectable()
export class AtendimentosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAtendimentoDto) {
    return this.prisma.atendimento.create({
      data: {
        alunoId: data.alunoId,
        dataAtendimento: new Date(data.dataAtendimento),
        tituloSessao: data.tituloSessao,
        observacoes: data.observacoes,
      },
    });
  }

  async findAllCalendario(mes: number, ano: number) {
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59);

    return this.prisma.atendimento.findMany({
      where: {
        dataAtendimento: {
          gte: dataInicio,
          lte: dataFim,
        },
      },
      include: {
        aluno: {
          select: { nomeCompleto: true },
        },
      },
      orderBy: {
        dataAtendimento: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const atendimento = await this.prisma.atendimento.findUnique({
      where: { id },
      include: {
        aluno: {
          select: { nomeCompleto: true },
        },
        atividades: {
          orderBy: { id: 'asc' },
          include: {
            itensChecklist: {
              orderBy: { id: 'asc' },
            },
          },
        },
      },
    });

    if (!atendimento) {
      throw new NotFoundException('Sessão de atendimento não encontrada.');
    }

    return atendimento;
  }

  async update(id: string, data: UpdateAtendimentoDto) {
    await this.findOne(id);

    const dadosAtualizados = { ...data };
    if (dadosAtualizados.dataAtendimento) {
      dadosAtualizados.dataAtendimento = new Date(
        dadosAtualizados.dataAtendimento,
      );
    }

    return this.prisma.atendimento.update({
      where: { id },
      data: dadosAtualizados,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.atendimento.delete({
      where: { id },
    });
  }
}
