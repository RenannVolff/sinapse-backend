import { Injectable, ConflictException } from '@nestjs/common';
import { CreateUsuarioDto } from './create-usuario.dto';
import { PrismaService } from '../../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsuariosService {
  constructor(private prisma: PrismaService) {}

  async create(createUsuarioDto: CreateUsuarioDto) {
    // Verifica se o email já existe
    const usuarioExiste = await this.prisma.usuario.findUnique({
      where: { email: createUsuarioDto.email },
    });

    if (usuarioExiste) {
      throw new ConflictException('Email já cadastrado.');
    }

    // Criptografia da senha
    const senhaHash = await bcrypt.hash(createUsuarioDto.senha, 10);

    // Cria no Banco de Dados
    return this.prisma.usuario.create({
      data: {
        nome: createUsuarioDto.nome,
        email: createUsuarioDto.email,
        senhaHash,
      },
      select: {
        id: true,
        nome: true,
        email: true,
      },
    });
  }

  findAll() {
    return this.prisma.usuario.findMany();
  }
}
