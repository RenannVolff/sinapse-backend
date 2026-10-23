import { ArgumentsHost, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { GlobalExceptionFilter } from './global-exception.filter';

function hostFalso() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({
        method: 'POST',
        originalUrl: '/auth/login?token=segredo',
        ip: '127.0.0.1',
      }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('GlobalExceptionFilter', () => {
  afterEach(() => jest.restoreAllMocks());

  it('erro do Prisma: corpo genérico e log só com classe e código, sem dados da query', () => {
    const erro = new Prisma.PrismaClientKnownRequestError(
      'Invalid `prisma.usuario.findFirst()` invocation: email "ana@exemplo.com"',
      { code: 'P2021', clientVersion: '5.22.0' },
    );
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { host, status, json } = hostFalso();

    new GlobalExceptionFilter().catch(erro, host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      code: 'INTERNAL_ERROR',
      message: 'Erro interno ao processar a solicitação.',
    });
    expect(log).toHaveBeenCalledWith(
      'POST /auth/login -> 500 (PrismaClientKnownRequestError P2021)',
    );
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/ana@exemplo|segredo/);
  });

  it('P2002 vira 409 sem citar campo ou tabela', () => {
    const erro = new Prisma.PrismaClientKnownRequestError('Unique (`email`)', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { host, json } = hostFalso();

    new GlobalExceptionFilter().catch(erro, host);

    expect(json).toHaveBeenCalledWith({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Registro já existe.',
    });
  });
});
