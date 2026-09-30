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

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  timestamp: string;
  path: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, message } = this.resolveStatusAndMessage(exception);

    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      // Esperado sob abuso: sem stack trace para não inundar o log
      this.logger.warn(
        `${request.method} ${request.originalUrl} -> ${statusCode} (ip ${request.ip})`,
      );
    } else if (statusCode < 500) {
      // 4xx é erro do cliente (validação, regra de negócio): o stack não
      // ajuda a diagnosticar nada e só polui o log. Nunca loga o corpo (LGPD).
      this.logger.warn(
        `${request.method} ${request.originalUrl} -> ${statusCode}`,
      );
    } else {
      this.logger.error(
        `${request.method} ${request.originalUrl} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponseBody = {
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    };

    response.status(statusCode).json(body);
  }

  private resolveStatusAndMessage(exception: unknown): {
    statusCode: number;
    message: string | string[];
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();

      // Rate limit (ThrottlerGuard): mensagem padrão da lib vem em inglês
      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        return {
          statusCode: status,
          message:
            'Muitas requisições. Aguarde um momento e tente novamente.',
        };
      }

      if (typeof response === 'string') {
        return { statusCode: status, message: response };
      }

      if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        const responseMessage = (response as { message: string | string[] })
          .message;
        return { statusCode: status, message: responseMessage };
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

    if (
      exception instanceof Prisma.PrismaClientValidationError ||
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    ) {
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

  private resolvePrismaKnownError(
    exception: Prisma.PrismaClientKnownRequestError,
  ): { statusCode: number; message: string } {
    switch (exception.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Já existe um registro com esses dados.',
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
