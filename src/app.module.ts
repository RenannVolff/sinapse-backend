import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AlunosModule } from './modules/alunos/alunos.module';
import { AtendimentosModule } from './modules/atendimentos/atendimentos.module';
import { AtividadesModule } from './modules/atividades/atividades.module';
import { RelatoriosModule } from './modules/relatorios/relatorios.module';

@Module({
  imports: [PrismaModule, UsuariosModule, AlunosModule, AtendimentosModule, AtividadesModule, RelatoriosModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
