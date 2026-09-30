import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

async function bootstrap() {
  // Sem JWT_SECRET, qualquer um que lesse o código conseguiria forjar tokens.
  // Checar aqui já funciona: o ConfigModule carrega o .env no import do AppModule.
  if (!process.env.JWT_SECRET?.trim()) {
    console.error(
      '\n[Sinapse] ERRO FATAL: a variável de ambiente JWT_SECRET não está definida.\n' +
        'O servidor não vai subir, porque sem ela os tokens de acesso não podem ser\n' +
        'assinados com segurança. Defina JWT_SECRET no .env (local) ou nas variáveis\n' +
        'de ambiente do servidor (Render). Para gerar um valor forte:\n' +
        "  node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"\n",
    );
    process.exit(1);
  }

  // bodyParser desligado: os limites de corpo JSON são registrados manualmente abaixo
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.use(helmet());

  // Confia no primeiro proxy (ngrok/Render) para o rate limit enxergar o IP real
  app.set('trust proxy', 1);

  // HTTPS forçado só em produção. Atrás do Render, req.secure vem do
  // X-Forwarded-Proto; sem esse cabeçalho (ex: health check interno) passa
  // direto. 308 em vez de 301 para preservar método e corpo em POST/PATCH.
  if (process.env.NODE_ENV === 'production') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.get('x-forwarded-proto') && !req.secure) {
        return res.redirect(308, `https://${req.get('host')}${req.originalUrl}`);
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

  const config = new DocumentBuilder()
    .setTitle('Sinapse Edu API')
    .setDescription(
      'API de Acompanhamento Neuropsicopedagógico Inteligente - TCC',
    )
    .setVersion('1.0')
    .addTag('Auth', 'Gestão de Acesso e Profissionais')
    .addTag('Aprendentes', 'Gestão de Aprendentes')
    .addTag('Atendimentos', 'Calendário e Sessões')
    .addTag('Atividades', 'Protocolos e Checklists')
    .addTag('Relatórios', 'Inteligência de Dados e Gráficos')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT || 3000);
}
void bootstrap();
