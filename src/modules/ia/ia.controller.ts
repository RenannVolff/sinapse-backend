import { Controller, Get, Param } from '@nestjs/common';
import { IaService } from './ia.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Inteligência Artificial')
@Controller('ia')
export class IaController {
  constructor(private readonly service: IaService) {}

  @Get('analise/:alunoId')
  @ApiOperation({
    summary: 'Gera um relatório textual automático',
    description:
      'Analisa os gráficos matemáticos e retorna um texto pedagógico pronto.',
  })
  gerarAnalise(@Param('alunoId') id: string) {
    return this.service.gerarRelatorioTextual(id);
  }
}
