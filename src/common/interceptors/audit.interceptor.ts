import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedUser } from '../../modules/auth/decorators/current-user.decorator';

interface RequestWithUser extends Request {
  user?: AuthenticatedUser;
}

const METHOD_TO_ACTION: Partial<Record<string, AuditAction>> = {
  POST: AuditAction.CREATE,
  PATCH: AuditAction.UPDATE,
  PUT: AuditAction.UPDATE,
  DELETE: AuditAction.DELETE,
  GET: AuditAction.READ,
};

// Controllers fora deste mapa (health check, auth, usuarios) não são auditados.
const AUDITED_RESOURCE_BY_CONTROLLER: Record<string, string> = {
  AprendentesController: 'APRENDENTE',
  AtendimentosController: 'ATENDIMENTO',
  AtividadesController: 'ATIVIDADE',
  RelatoriosController: 'RELATORIO',
  IaController: 'IA',
  PeiController: 'PEI',
  PeiTemplateController: 'PEI_TEMPLATE',
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const resource = AUDITED_RESOURCE_BY_CONTROLLER[context.getClass().name];
    const action = METHOD_TO_ACTION[request.method];

    if (!resource || !action) {
      return next.handle();
    }

    // READ só audita acesso a um registro específico, não listagens (GET /aprendentes).
    const routeParams: Record<string, string | string[]> = request.params ?? {};
    const hasRouteParams = Object.keys(routeParams).length > 0;
    if (action === AuditAction.READ && !hasRouteParams) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        this.registrar(request, action, resource, routeParams);
      }),
    );
  }

  // Fire-and-forget: não bloqueia a resposta nem derruba a requisição em caso de falha.
  private registrar(
    request: RequestWithUser,
    action: AuditAction,
    resource: string,
    routeParams: Record<string, string | string[]>,
  ): void {
    const userId = request.user?.id;
    if (!userId) {
      return;
    }

    const firstParam = Object.values(routeParams)[0];
    const resourceId = Array.isArray(firstParam)
      ? (firstParam[0] ?? null)
      : (firstParam ?? null);
    const ipAddress = request.ip ?? null;

    this.prisma.auditLog
      .create({
        data: { userId, action, resource, resourceId, ipAddress },
      })
      .catch((error: unknown) => {
        this.logger.error(
          'Falha ao gravar audit log',
          error instanceof Error ? error.stack : String(error),
        );
      });
  }
}
