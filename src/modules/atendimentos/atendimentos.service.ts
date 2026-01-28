import { Injectable } from '@nestjs/common';
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

  // Busca atendimentos de um aluno específico (para o Histórico)
  findAllByAluno(alunoId: string) {
    return this.prisma.atendimento.findMany({
      where: { alunoId },
      orderBy: { dataAtendimento: 'desc' }, // Mais recentes primeiro
      include: { atividades: true }, // Vai trazer as atividades desta sessão
    });
  }

  // Busca atendimentos por mês (para o Calendário)
  async findByMonth(mes: number, ano: number) {
    // Lógica simples: pegar do dia 1 ao dia 31 daquele mês
    const inicio = new Date(ano, mes - 1, 1);
    const fim = new Date(ano, mes, 0);

    return this.prisma.atendimento.findMany({
      where: {
        dataAtendimento: {
          gte: inicio,
          lte: fim,
        },
      },
      include: { aluno: { select: { nomeCompleto: true } } },
    });
  }
}
