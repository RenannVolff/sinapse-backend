import { Module } from '@nestjs/common';
import { RelatoriosService } from './relatorios.service';
import { RelatoriosController } from './relatorios.controller';

@Module({
  controllers: [RelatoriosController],
  providers: [RelatoriosService],
  exports: [RelatoriosService], // Permite que outros módulos usem este serviço
})
export class RelatoriosModule {}
