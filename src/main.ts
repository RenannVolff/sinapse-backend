import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import helmet from 'helmet';

async function bootstrap() {
  // 0. Segredo do JWT obrigatório: sem ele, qualquer um que leia o código
  // conseguiria forjar tokens. O .env já foi carregado pelo ConfigModule
  // durante o import do AppModule.
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

  // 0.1 Cabeçalhos de segurança HTTP
  app.use(helmet());

  // 0.2 Confia no primeiro proxy (ngrok/Render) para o rate limit enxergar o IP real
  app.set('trust proxy', 1);

  // 0.3 Limites do corpo JSON. A ORDEM IMPORTA: o parser de 15mb (exportação
  // .docx envia 3 gráficos em base64) precisa vir antes do de 100kb, que
  // ignora requisições cujo corpo já foi lido.
  app.use('/aprendentes/:id/exportar-docx', json({ limit: '15mb' }));
  app.use(json({ limit: '100kb' }));

  // 1. Validação Global (Segurança e Tipagem)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Remove dados não permitidos no DTO
      forbidNonWhitelisted: true, // Retorna erro se enviar lixo
      transform: true, // Converte tipos (ex: string "1" vira number 1)
    }),
  );

  // 1.1 Filtro Global de Exceções (nunca vaza erro interno do Prisma/Postgres ao cliente)
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 2. Habilitar CORS (Para o Frontend conectar sem bloqueio)
  app.enableCors();

  // 3. Configuração do Swagger (Documentação Profissional)
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
