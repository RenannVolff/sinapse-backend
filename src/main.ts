import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from './app.setup';

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

  // bodyParser desligado: os limites de corpo JSON são registrados em configureApp()
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  configureApp(app);

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
