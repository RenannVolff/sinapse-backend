import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload, TIPO_TOKEN_PRE_AUTH_2FA } from './auth.service';
import { AuthenticatedUser } from './decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Sem valor padrão: main.ts recusa subir sem JWT_SECRET
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    // Defesa em profundidade: o token temporário do 2FA já é assinado com
    // outro segredo, mas nunca deve valer como sessão, mesmo assim.
    if (payload.tipo === TIPO_TOKEN_PRE_AUTH_2FA) {
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
    });

    if (!usuario) {
      throw new UnauthorizedException('Usuário não encontrado ou inativo.');
    }

    return { id: payload.sub, email: payload.email };
  }
}
