import { Injectable } from '@nestjs/common';
import { CreateAlunoDto } from './dto/create-aluno.dto';
import { PrismaService } from '../../prisma/prisma.service';

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

  // Listagem de todos os alunos e traz o nome do profissional/terapeuta junto
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
}
