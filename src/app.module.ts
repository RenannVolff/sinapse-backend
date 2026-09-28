import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AprendentesModule } from './modules/aprendentes/aprendentes.module';
import { AtendimentosModule } from './modules/atendimentos/atendimentos.module';
import { AtividadesModule } from './modules/atividades/atividades.module';
import { RelatoriosModule } from './modules/relatorios/relatorios.module';
import { IaModule } from './modules/ia/ia.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { PeiModule } from './modules/pei/pei.module';
import { PeiTemplateModule } from './modules/pei-templates/pei-template.module';
import { TarefasModule } from './modules/tarefas/tarefas.module';
import { ExportacaoModule } from './modules/exportacao/exportacao.module';
import { EmailModule } from './modules/email/email.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Limite padrão generoso (por IP): o front faz várias chamadas por tela
    // e polling de notificações a cada 60s. Rotas sensíveis apertam com @Throttle.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    PrismaModule,
    UsuariosModule,
    AprendentesModule,
    AtendimentosModule,
    AtividadesModule,
    RelatoriosModule,
    IaModule,
    AuthModule,
    DashboardModule,
    AuditLogsModule,
    PeiModule,
    PeiTemplateModule,
    TarefasModule,
    ExportacaoModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guards globais executam na ordem de registro: o rate limit vem antes
    // da autenticação, para barrar abuso sem gastar validação de JWT.
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
