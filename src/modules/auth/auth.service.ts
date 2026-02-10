import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const { email, senha } = loginDto;

    // 1. Busca usuário pelo email
    const usuario = await this.prisma.usuario.findUnique({
      where: { email },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // 2. Compara a senha digitada com o hash do banco
    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);

    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // 3. Gera o Token de Acesso (JWT)
    const payload = { sub: usuario.id, email: usuario.email };

    return {
      access_token: await this.jwtService.signAsync(payload),
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
      },
    };
  }
}
