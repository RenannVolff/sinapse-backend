import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from '../email/email.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

const TOKEN_VERIFICACAO_VALIDADE_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // Gera um token aleatório, guarda só o HASH (nunca o valor puro) com prazo
  // de 24h, e envia o token em texto puro por e-mail — quem tem só o banco
  // não consegue forjar um link de verificação válido.
  async gerarEEnviarTokenVerificacao(
    usuarioId: string,
    email: string,
  ): Promise<void> {
    const tokenPuro = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(tokenPuro).digest('hex');

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        tokenVerificacao: tokenHash,
        tokenVerificacaoExpiraEm: new Date(Date.now() + TOKEN_VERIFICACAO_VALIDADE_MS),
      },
    });

    await this.emailService.enviarEmailVerificacao(email, tokenPuro);
  }

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
      const usuario = await this.prisma.usuario.create({
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

      await this.gerarEEnviarTokenVerificacao(usuario.id, usuario.email);

      return usuario;
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
