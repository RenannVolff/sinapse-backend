import { Controller, Post, Body, Patch, Param } from '@nestjs/common';
import { AtividadesService } from './atividades.service';
import { CreateAtividadeDto } from './dto/create-atividade.dto';

@Controller('atividades')
export class AtividadesController {
  constructor(private readonly service: AtividadesService) {}

  @Post()
  create(@Body() dto: CreateAtividadeDto) {
    return this.service.create(dto);
  }

  // Marcar tentativa (Checkbox)
  @Patch('tentativa/:id')
  toggleItem(@Param('id') id: string, @Body('realizado') realizado: boolean) {
    return this.service.toggleItem(id, realizado);
  }

  // Salvar a observação geral da atividade
  // Rota: PATCH /atividades/observacao/uuid-da-atividade
  // Body: { "texto": "O aluno teve dificuldade na preensão..." }
  @Patch('observacao/:id')
  updateObservacao(@Param('id') id: string, @Body('texto') texto: string) {
    return this.service.updateObservacao(id, texto);
  }
}
