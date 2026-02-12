import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

// Interface para tipagem segura do Payload (evita 'any')
interface UserPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'segredo_padrao_tcc', // Mesma chave do AuthModule
    });
  }

  // O NestJS chama isso automaticamente se o token for válido
  validate(payload: UserPayload) {
    // O que retornarmos aqui fica disponível em 'request.user' nas rotas
    return { id: payload.sub, email: payload.email };
  }
}
