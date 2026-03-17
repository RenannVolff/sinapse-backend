import { Controller, Post, Body, Patch, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AtividadesService } from './atividades.service';

@ApiTags('Atividades')
@Controller('atividades')
export class AtividadesController {
  constructor(private readonly atividadesService: AtividadesService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma atividade com 5 tentativas' })
  create(
    @Body()
    body: {
      atendimentoId: string;
      titulo: string;
      nivelDificuldade: number;
    },
  ) {
    return this.atividadesService.create(body);
  }

  // --- A ROTA QUE FALTAVA ---
  @Patch('checklist/:id')
  @ApiOperation({ summary: 'Marca ou desmarca uma tentativa (Checklist)' })
  updateChecklist(
    @Param('id') id: string,
    @Body() body: { realizado: boolean },
  ) {
    return this.atividadesService.updateChecklist(id, body.realizado);
  }
}
