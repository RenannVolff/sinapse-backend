import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  sub: string;
  email: string;
}

const MENSAGEM_REENVIO_GENERICA =
  'Se este e-mail estiver cadastrado e pendente de verificação, um novo link de confirmação foi enviado.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly usuariosService: UsuariosService,
  ) {}

  async login(dados: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dados.email },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (!usuario.emailVerificado) {
      throw new ForbiddenException(
        'Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada ou solicite um novo link em /auth/reenviar-verificacao.',
      );
    }

    const senhaValida = await bcrypt.compare(dados.senha, usuario.senhaHash);

    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const payload: JwtPayload = { sub: usuario.id, email: usuario.email };

    return {
      token: await this.jwtService.signAsync(payload),
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
      },
    };
  }

  // Confirma o cadastro a partir do token de verificação enviado por e-mail.
  // Compara o HASH do token recebido (nunca o valor puro é armazenado) e
  // exige prazo ainda válido.
  async verificarEmail(tokenPuro: string): Promise<{ mensagem: string }> {
    const tokenHash = crypto.createHash('sha256').update(tokenPuro).digest('hex');

    const usuario = await this.prisma.usuario.findFirst({
      where: { tokenVerificacao: tokenHash },
    });

    if (
      !usuario ||
      !usuario.tokenVerificacaoExpiraEm ||
      usuario.tokenVerificacaoExpiraEm < new Date()
    ) {
      throw new BadRequestException(
        'Token de verificação inválido ou expirado. Solicite um novo em /auth/reenviar-verificacao.',
      );
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        emailVerificado: true,
        tokenVerificacao: null,
        tokenVerificacaoExpiraEm: null,
      },
    });

    return { mensagem: 'E-mail verificado com sucesso. Você já pode fazer login.' };
  }

  // Reenvia o e-mail de verificação SE o usuário existir e ainda não tiver
  // confirmado o cadastro — mas sempre responde com a mesma mensagem
  // genérica, pra não revelar se aquele e-mail existe no sistema.
  async reenviarVerificacao(email: string): Promise<{ mensagem: string }> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });

    if (usuario && !usuario.emailVerificado) {
      await this.usuariosService.gerarEEnviarTokenVerificacao(
        usuario.id,
        usuario.email,
      );
    }

    return { mensagem: MENSAGEM_REENVIO_GENERICA };
  }
}
