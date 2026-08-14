import { Module } from '@nestjs/common';
import { AprendentesService } from './aprendentes.service';
import { AprendentesController } from './aprendentes.controller';

// Este módulo é responsável por gerenciar as operações relacionadas aos aprendentes, como cadastro,
// listagem, atualização e exclusão. Ele é independente do módulo de autenticação
@Module({
  controllers: [AprendentesController],
  providers: [AprendentesService],
})
export class AprendentesModule {}
