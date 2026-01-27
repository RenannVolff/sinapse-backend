import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { AlunosModule } from './modules/alunos/alunos.module';
import { AtendimentosModule } from './modules/atendimentos/atendimentos.module';

@Module({
  imports: [PrismaModule, UsuariosModule, AlunosModule, AtendimentosModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
