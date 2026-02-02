import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateAtendimentoDto } from './dto/create-atendimento.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AtendimentosService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAtendimentoDto) {
    return this.prisma.atendimento.create({
      data: {
        alunoId: dto.alunoId,
        dataAtendimento: new Date(dto.dataAtendimento),
        tituloSessao: dto.tituloSessao,
        observacoes: dto.observacoes,
      },
    });
  }

  findAllByAluno(alunoId: string) {
    return this.prisma.atendimento.findMany({
      where: { alunoId },
      orderBy: { dataAtendimento: 'desc' },
      include: { atividades: true },
    });
  }

  async findByMonth(mes: number, ano: number) {
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0);

    return this.prisma.atendimento.findMany({
      where: {
        dataAtendimento: {
          gte: inicio,
          lte: fim,
        },
      },
      include: {
        aluno: {
          select: { nomeCompleto: true },
        },
      },
    });
  }

  // --- NOVAS FUNÇÕES PARA CALENDÁRIO INTERATIVO ---

  // Reagendar (Drag & Drop)
  async updateData(id: string, novaDataString: string) {
    // Verifica se existe antes de tentar atualizar
    const existe = await this.prisma.atendimento.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Atendimento não encontrado');

    return this.prisma.atendimento.update({
      where: { id },
      data: { dataAtendimento: new Date(novaDataString) },
    });
  }

  // Excluir sessão
  async remove(id: string) {
    const existe = await this.prisma.atendimento.findUnique({ where: { id } });
    if (!existe) throw new NotFoundException('Atendimento não encontrado');

    return this.prisma.atendimento.delete({
      where: { id },
    });
  }
}
