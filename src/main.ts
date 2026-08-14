import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  await app.listen(3000);
}
void bootstrap();
