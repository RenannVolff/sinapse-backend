import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from './app.setup';
import { criarDocumentoSwagger } from './swagger';

// Aborta a subida com uma mensagem clara. Checar aqui já funciona: o
// ConfigModule carrega o .env no import do AppModule.
function erroFatal(mensagem: string): never {
  console.error(`\n[Sinapse] ERRO FATAL: ${mensagem}\n`);
  process.exit(1);
}

function validarAmbiente(): void {
  // Sem JWT_SECRET, qualquer um que lesse o código conseguiria forjar tokens.
  if (!process.env.JWT_SECRET?.trim()) {
    erroFatal(
      'a variável de ambiente JWT_SECRET não está definida.\n' +
        'O servidor não vai subir, porque sem ela os tokens de acesso não podem ser\n' +
        'assinados com segurança. Defina JWT_SECRET no .env (local) ou nas variáveis\n' +
        'de ambiente do servidor (Render). Para gerar um valor forte:\n' +
        "  node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\"",
    );
  }

  if (process.env.NODE_ENV !== 'production') return;

  // Em produção não há fallback: sem banco o app não funciona, e sem
  // FRONTEND_URL o CORS bloquearia o frontend e os links de e-mail sairiam
  // quebrados.
  const obrigatorias: Record<string, string> = {
    DATABASE_URL: 'conexão com o PostgreSQL (Neon)',
    FRONTEND_URL:
      'origem(ns) do frontend para o CORS e os links de e-mail, separadas por vírgula',
  };
  const faltando = Object.keys(obrigatorias).filter(
    (nome) => !process.env[nome]?.trim(),
  );
  if (faltando.length > 0) {
    erroFatal(
      `NODE_ENV=production e faltam variáveis de ambiente obrigatórias:\n` +
        faltando
          .map((nome) => `  - ${nome}: ${obrigatorias[nome]}`)
          .join('\n') +
        '\nO servidor não vai subir. Defina-as nas variáveis de ambiente do\n' +
        'servidor (Render) — veja .env.example e DEPLOY.md.',
    );
  }
}

async function bootstrap() {
  validarAmbiente();

  // bodyParser desligado: os limites de corpo JSON são registrados em configureApp()
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  configureApp(app);

  // Desligado por padrão em produção; SWAGGER_ENABLED=true liga para a demonstração.
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.SWAGGER_ENABLED === 'true'
  ) {
    SwaggerModule.setup('api/docs', app, criarDocumentoSwagger(app));
  }

  await app.listen(process.env.PORT || 3000);
}
void bootstrap();
