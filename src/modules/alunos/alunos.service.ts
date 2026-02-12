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
}
