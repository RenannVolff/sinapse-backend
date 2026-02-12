import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from './decorators/is-public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // 1. Verifica se a rota é pública
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // 2. Se não for pública, valida o Token
    return super.canActivate(context);
  }

  // Correção dos tipos "unsafe"
  handleRequest<TUser = any>(err: any, user: any): TUser {
    // Se houver erro ou não houver usuário, lança exceção
    if (err || !user) {
      throw err || new UnauthorizedException('Token inválido ou expirado');
    }

    // Retorna o usuário com tipagem segura
    return user as TUser;
  }
}
