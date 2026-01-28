import { Module } from '@nestjs/common';
import { AtividadesService } from './atividades.service';
import { AtividadesController } from './atividades.controller';

@Module({
  controllers: [AtividadesController],
  providers: [AtividadesService],
})
export class AtividadesModule {}
