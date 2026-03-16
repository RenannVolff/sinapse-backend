import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateAtendimentoDto {
  alunoId: string;
  dataAtendimento: string | Date;
  tituloSessao: string;
  observacoes?: string;
}

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
    // Busca do primeiro ao último dia do mês
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

  // === A FUNÇÃO QUE FALTAVA (COM O PRISMA CORRIGIDO) ===
  async findOne(id: string) {
    const atendimento = await this.prisma.atendimento.findUnique({
      where: { id },
      include: {
        aluno: {
          select: {
            nomeCompleto: true,
          },
        },
        atividades: {
          // Solução segura: usa o ID para manter a ordem de criação sem causar erros de nome de coluna
          orderBy: {
            id: 'asc',
          },
          include: {
            itensChecklist: {
              // Garante que a 1ª, 2ª, 3ª tentativa fiquem na ordem correta
              orderBy: {
                id: 'asc',
              },
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
}
