import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

// Configuração compartilhada entre o main.ts e a suíte e2e (test/), para que
// os testes exercitem exatamente a mesma pilha de middlewares, pipes e
// filtros da aplicação real. O app precisa ter sido criado com
// `bodyParser: false`, já que os parsers JSON são registrados aqui.
export function configureApp(app: NestExpressApplication): void {
  app.use(helmet());

  // Confia no primeiro proxy (ngrok/Render) para o rate limit enxergar o IP real
  app.set('trust proxy', 1);

  // HTTPS forçado só em produção. Atrás do Render, req.secure vem do
  // X-Forwarded-Proto; sem esse cabeçalho (ex: health check interno) passa
  // direto. 308 em vez de 301 para preservar método e corpo em POST/PATCH.
  if (process.env.NODE_ENV === 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.get('x-forwarded-proto') && !req.secure) {
        return res.redirect(
          308,
          `https://${req.get('host')}${req.originalUrl}`,
        );
      }
      next();
    });
  }

  // A ORDEM IMPORTA: o parser de 15mb (o .docx leva 3 gráficos em base64)
  // tem que vir antes do de 100kb, que ignora corpos já lidos.
  app.use('/aprendentes/:id/exportar-docx', json({ limit: '15mb' }));
  app.use(json({ limit: '100kb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // descarta campos fora do DTO
      forbidNonWhitelisted: true, // ...e responde 400 em vez de ignorar em silêncio
      transform: true, // converte tipos (ex: string "1" vira number 1)
    }),
  );

  // Nunca vaza erro interno do Prisma/Postgres ao cliente
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.enableCors();
}
