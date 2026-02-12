import { Module } from '@nestjs/common';
import { AlunosService } from './alunos.service';
import { AlunosController } from './alunos.controller';

// Este módulo é responsável por gerenciar as operações relacionadas aos alunos, como cadastro,
// listagem, atualização e exclusão. Ele é independente do módulo de autenticação,
// mas pode ser protegido por ele usando Guards e Decorators.
@Module({
  controllers: [AlunosController],
  providers: [AlunosService],
})
export class AlunosModule {}
