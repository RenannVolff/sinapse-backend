import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
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
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  imports: [
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
