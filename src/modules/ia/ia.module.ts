import { Module } from '@nestjs/common';
import { IaService } from './ia.service';
import { IaController } from './ia.controller';
import { RelatoriosModule } from '../relatorios/relatorios.module'; // Importar isso!

@Module({
  imports: [RelatoriosModule], // Permite usar o RelatoriosService dentro da IA
  controllers: [IaController],
  providers: [IaService],
})
export class IaModule {}
