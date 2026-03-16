import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateAlunoDto {
  nomeCompleto: string;
  dataNascimento: string | Date;
  responsavel: string;
  contato: string;
  usuarioId: string;
}

@Injectable()
export class AlunosService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateAlunoDto) {
    return this.prisma.aluno.create({
      data: {
        nomeCompleto: data.nomeCompleto,
        dataNascimento: new Date(data.dataNascimento),
        responsavel: data.responsavel,
        contato: data.contato,
        usuarioId: data.usuarioId,
      },
    });
  }

  async findAll() {
    return this.prisma.aluno.findMany({
      orderBy: { criadoEm: 'desc' },
    });
  }

  // --- NOVA FUNÇÃO: Busca um aluno específico e seu histórico ---
  async findOne(id: string) {
    const aluno = await this.prisma.aluno.findUnique({
      where: { id },
      include: {
        atendimentos: {
          orderBy: { dataAtendimento: 'desc' }, // Traz as sessões mais recentes primeiro
        },
      },
    });

    if (!aluno) {
      throw new NotFoundException('Aluno não encontrado na base de dados.');
    }

    return aluno;
  }

  async gerarDadosEvolucao(alunoId: string) {
    const sessoes = await this.prisma.atendimento.findMany({
      where: { alunoId },
      orderBy: { dataAtendimento: 'asc' },
      include: {
        atividades: {
          include: { itensChecklist: true },
        },
      },
    });

    const dadosGrafico = sessoes.map((sessao) => {
      let scoreTotalSessao = 0;
      let pesoTotalSessao = 0;

      sessao.atividades.forEach((ativ) => {
        const acertos = ativ.itensChecklist.filter((i) => i.realizado).length;
        const scoreAtividade = (acertos / 5) * 100;

        scoreTotalSessao += scoreAtividade * ativ.nivelDificuldade;
        pesoTotalSessao += ativ.nivelDificuldade;
      });

      const mediaSessao =
        pesoTotalSessao > 0
          ? Math.round(scoreTotalSessao / pesoTotalSessao)
          : 0;

      return {
        data: sessao.dataAtendimento.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
        }),
        titulo: sessao.tituloSessao,
        score: mediaSessao,
      };
    });

    return dadosGrafico.filter((d) => d.score > 0);
  }
}
