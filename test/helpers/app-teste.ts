import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { EmailService } from '../../src/modules/email/email.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { limparBanco } from './banco';
import { EmailServiceFalso } from './email-falso';

export interface AppTeste {
  app: INestApplication<App>;
  prisma: PrismaService;
  email: EmailServiceFalso;
  // Cliente HTTP em que cada requisição sai de um IP diferente (ver abaixo).
  api: ClienteHttp;
  fechar: () => Promise<void>;
}

// Sobe a aplicação real (AppModule + configureApp, igual ao main.ts), com
// o EmailService trocado por um falso, e limpa o banco de teste.
export async function criarAppTeste(): Promise<AppTeste> {
  const email = new EmailServiceFalso();

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(EmailService)
    .useValue(email)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    logger: ['fatal'],
  });
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  await limparBanco(prisma);

  return {
    app,
    prisma,
    email,
    api: clienteHttp(app),
    fechar: () => app.close(),
  };
}

export interface ClienteHttp {
  get: (url: string) => request.Test;
  post: (url: string) => request.Test;
  patch: (url: string) => request.Test;
  delete: (url: string) => request.Test;
}

let contadorIp = 0;

// 10.x.y.z único a cada chamada.
export function novoIp(): string {
  contadorIp++;
  return `10.${(contadorIp >> 16) & 255}.${(contadorIp >> 8) & 255}.${contadorIp & 255}`;
}

// O ThrottlerGuard conta requisições por IP e o app confia no primeiro proxy
// (trust proxy = 1), então o X-Forwarded-For define o IP visto pelo rate
// limit. Sem `ip` fixo, cada requisição vem de um IP novo e os testes de
// negócio não esbarram nos limites; a suíte de proteção fixa o IP para
// exercitá-los de propósito.
export function clienteHttp(
  app: INestApplication<App>,
  ip?: string,
): ClienteHttp {
  const servidor = app.getHttpServer();
  const comIp = (t: request.Test) => t.set('X-Forwarded-For', ip ?? novoIp());
  return {
    get: (url) => comIp(request(servidor).get(url)),
    post: (url) => comIp(request(servidor).post(url)),
    patch: (url) => comIp(request(servidor).patch(url)),
    delete: (url) => comIp(request(servidor).delete(url)),
  };
}
