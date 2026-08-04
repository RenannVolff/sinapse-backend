import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUsuarioDto) {
    //
    const emailEmUso = await this.prisma.usuario.findUnique({
      where: { email: data.email },
    });

    if (emailEmUso) {
      throw new ConflictException('Este e-mail já está cadastrado no sistema.');
    }

    //
    const saltRounds = 10;
    const senhaHash = await bcrypt.hash(data.senha, saltRounds);

    try {
      //
      return await this.prisma.usuario.create({
        data: {
          nome: data.nome,
          email: data.email,
          senhaHash: senhaHash,
        },
        select: {
          id: true,
          nome: true,
          email: true,
          criadoEm: true,
        },
      });
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw new InternalServerErrorException(
        'Erro ao cadastrar o terapeuta no banco de dados.',
      );
    }
  }

  //
  async update(id: string, data: UpdateUsuarioDto) {
    const usuarioAtual = await this.prisma.usuario.findUnique({
      where: { id },
    });
    if (!usuarioAtual) throw new NotFoundException('Usuário não encontrado.');

    if (data.email && data.email !== usuarioAtual.email) {
      const emailEmUso = await this.prisma.usuario.findUnique({
        where: { email: data.email },
      });
      if (emailEmUso)
        throw new ConflictException('Este e-mail já está sendo utilizado.');
    }

    const dadosParaAtualizar: Prisma.UsuarioUpdateInput = {};
    if (data.nome) dadosParaAtualizar.nome = data.nome;
    if (data.email) dadosParaAtualizar.email = data.email;

    if (data.senha) {
      const saltRounds = 10;
      dadosParaAtualizar.senhaHash = await bcrypt.hash(data.senha, saltRounds);
    }

    try {
      return await this.prisma.usuario.update({
        where: { id },
        data: dadosParaAtualizar,
        select: { id: true, nome: true, email: true },
      });
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw new InternalServerErrorException(
        'Ocorreu um erro interno no banco de dados.',
      );
    }
  }
}
