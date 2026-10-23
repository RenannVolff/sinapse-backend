import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ErroCampo } from '../validation/mensagens-validacao';

// Formato único de erro (contrato com o front). Nunca leva stack, caminho
// da requisição, SQL, nome de tabela/coluna nem texto do Prisma.
interface ErrorResponseBody {
  statusCode: number;
  code: string;
  message: string;
  errors?: ErroCampo[];
}

const CODIGOS_POR_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

function codigoPorStatus(status: number): string {
  return (
    CODIGOS_POR_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'ERROR')
  );
}

type ErroResolvido = Omit<ErrorResponseBody, 'code'> & { code?: string };

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const resolvido = this.resolveStatusAndMessage(exception);
    const { statusCode } = resolvido;
    // Sem a query string: ela pode trazer tokens (ex: verificar-email?token=)
    const rota = request.originalUrl.split('?')[0];

    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      // Esperado sob abuso: sem stack trace para não inundar o log
      this.logger.warn(
        `${request.method} ${rota} -> ${statusCode} (ip ${request.ip})`,
      );
    } else if (statusCode < 500) {
      // 4xx é erro do cliente (validação, regra de negócio): o stack não
      // ajuda a diagnosticar nada e só polui o log. Nunca loga o corpo (LGPD).
      this.logger.warn(`${request.method} ${rota} -> ${statusCode}`);
    } else if (this.ehErroPrisma(exception)) {
      // A mensagem do Prisma repete os argumentos da query (nomes, e-mails,
      // observações): loga só a classe e o código do erro.
      const codigo = (exception as { code?: unknown }).code;
      this.logger.error(
        `${request.method} ${rota} -> ${statusCode} (${exception.constructor.name}${typeof codigo === 'string' ? ` ${codigo}` : ''})`,
      );
    } else {
      this.logger.error(
        `${request.method} ${rota} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      statusCode,
      code: resolvido.code ?? codigoPorStatus(statusCode),
      message: resolvido.message,
      ...(resolvido.errors ? { errors: resolvido.errors } : {}),
    };

    response.status(statusCode).json(body);
  }

  private resolveStatusAndMessage(exception: unknown): ErroResolvido {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      // Rate limit (ThrottlerGuard): mensagem padrão da lib vem em inglês
      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        return {
          statusCode: status,
          message: 'Muitas requisições. Aguarde um momento e tente novamente.',
        };
      }

      // Rota inexistente: o Nest responde "Cannot GET /rota", em inglês
      if (
        status === HttpStatus.NOT_FOUND &&
        /^Cannot [A-Z]+ /.test(exception.message)
      ) {
        return { statusCode: status, message: 'Rota não encontrada.' };
      }

      // Parâmetro de rota com codificação inválida (ex: /aprendentes/%FF):
      // o Nest repassa a mensagem do Express ("Failed to decode param"), em inglês
      if (
        status === HttpStatus.BAD_REQUEST &&
        /^(Failed to decode param|URI malformed)/.test(exception.message)
      ) {
        return {
          statusCode: status,
          message: 'O endereço da requisição contém caracteres inválidos.',
        };
      }

      if (typeof response === 'string') {
        return { statusCode: status, message: response };
      }

      if (typeof response === 'object' && response !== null) {
        const corpo = response as {
          code?: unknown;
          message?: unknown;
          errors?: unknown;
        };
        // Erro de validação (ValidationPipe ou excecaoValidacao): repassa
        // código e lista de campos como vieram.
        if (Array.isArray(corpo.errors)) {
          return {
            statusCode: status,
            code: typeof corpo.code === 'string' ? corpo.code : undefined,
            message: this.comoTexto(corpo.message, exception.message),
            errors: corpo.errors as ErroCampo[],
          };
        }
        if ('message' in corpo) {
          return {
            statusCode: status,
            message: this.comoTexto(corpo.message, exception.message),
          };
        }
      }

      return { statusCode: status, message: exception.message };
    }

    // Erro do body-parser (express) quando o corpo excede o limite configurado no main.ts
    if (
      typeof exception === 'object' &&
      exception !== null &&
      (exception as { type?: unknown }).type === 'entity.too.large'
    ) {
      return {
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        message: 'O conteúdo enviado excede o tamanho máximo permitido.',
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaKnownError(exception);
    }

    if (this.ehErroPrisma(exception)) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Erro interno ao processar a solicitação.',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno do servidor.',
    };
  }

  private ehErroPrisma(exception: unknown): exception is Error {
    return (
      exception instanceof Prisma.PrismaClientKnownRequestError ||
      exception instanceof Prisma.PrismaClientValidationError ||
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    );
  }

  // `message` do contrato é sempre um texto; listas antigas viram uma frase.
  private comoTexto(valor: unknown, padrao: string): string {
    if (typeof valor === 'string') return valor;
    if (Array.isArray(valor)) return valor.map(String).join(' ');
    return padrao;
  }

  private resolvePrismaKnownError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): { statusCode: number; message: string } {
    switch (exception.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Registro já existe.',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Registro não encontrado.',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message: 'Erro interno ao processar a solicitação.',
        };
    }
  }
}
