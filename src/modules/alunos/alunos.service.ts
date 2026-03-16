import { Injectable } from '@nestjs/common';
import { CreateAlunoDto } from './dto/create-aluno.dto';
import { PrismaService } from '../../prisma/prisma.service';

// O serviço de Alunos é responsável por toda a lógica de negócios relacionada aos alunos, como criação, listagem e busca.
// Ele interage diretamente com o PrismaService para acessar o banco de dados.
@Injectable()
export class AlunosService {
  constructor(private prisma: PrismaService) {}

  // Cria um novo aluno no Banco de Dados
  async create(createAlunoDto: CreateAlunoDto) {
    return this.prisma.aluno.create({
      data: {
        nomeCompleto: createAlunoDto.nomeCompleto,
        // Conversão crítica: String -> Date ISO-8601
        dataNascimento: new Date(createAlunoDto.dataNascimento),
        responsavel: createAlunoDto.responsavel,
        contato: createAlunoDto.contato,
        usuarioId: createAlunoDto.usuarioId, // Vincula este aluno ao profissional/terapeuta
      },
    });
  }

  // Listagem de todos os alunos e traz o nome do profissional/terapeuta incluso
  findAll() {
    return this.prisma.aluno.findMany({
      include: {
        usuario: {
          select: {
            nome: true,
            email: true,
          },
        },
      },
      orderBy: {
        nomeCompleto: 'asc',
      },
    });
  }

  // Busca um aluno específico pelo ID
  findOne(id: string) {
    return this.prisma.aluno.findUnique({
      where: { id },
    });
  }

  async gerarDadosEvolucao(alunoId: string) {
    // Busca todas as sessões do aluno que têm atividades
    const sessoes = await this.prisma.atendimento.findMany({
      where: { alunoId },
      orderBy: { dataAtendimento: 'asc' },
      include: {
        atividades: {
          include: { itensChecklist: true },
        },
      },
    });

    // Calcula a pontuação matemática de cada sessão
    const dadosGrafico = sessoes.map((sessao) => {
      let scoreTotalSessao = 0;
      let pesoTotalSessao = 0;

      sessao.atividades.forEach((ativ) => {
        const acertos = ativ.itensChecklist.filter((i) => i.realizado).length;
        // Fórmula: (Acertos / 5) * 100 * Dificuldade
        const scoreAtividade = (acertos / 5) * 100;

        scoreTotalSessao += scoreAtividade * ativ.nivelDificuldade;
        pesoTotalSessao += ativ.nivelDificuldade;
      });

      // Média ponderada da sessão (evita divisão por zero)
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

    // Remove sessões que não tiveram atividades (score 0 por falta de dados)
    return dadosGrafico.filter((d) => d.score > 0);
  }
}
