import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async update(id: string, data: UpdateUsuarioDto) {
    const usuarioAtual = await this.prisma.usuario.findUnique({
      where: { id },
    });
    if (!usuarioAtual) {
      throw new NotFoundException('Usuário não encontrado no sistema.');
    }

    if (data.email && data.email !== usuarioAtual.email) {
      const emailEmUso = await this.prisma.usuario.findUnique({
        where: { email: data.email },
      });
      if (emailEmUso) {
        throw new ConflictException(
          'Este e-mail já está sendo utilizado por outro profissional.',
        );
      }
    }

    const dadosParaAtualizar: Prisma.UsuarioUpdateInput = {};
    if (data.nome) dadosParaAtualizar.nome = data.nome;
    if (data.email) dadosParaAtualizar.email = data.email;
    // A CORREÇÃO DE OURO: O campo do DTO é 'senha', mas salvamos em 'senhaHash' no banco!
    if (data.senha) {
      const saltRounds = 10;
      const hashGerado = await bcrypt.hash(data.senha, saltRounds);
      dadosParaAtualizar.senhaHash = hashGerado; // <-- AQUI!
    }

    try {
      return await this.prisma.usuario.update({
        where: { id },
        data: dadosParaAtualizar,
        select: {
          id: true,
          nome: true,
          email: true,
        },
      });
    } catch (error: unknown) {
      console.error('Erro CRÍTICO no banco ao atualizar usuário:', error);
      throw new InternalServerErrorException(
        'Ocorreu um erro interno no banco de dados.',
      );
    }
  }
}
