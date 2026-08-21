import { Controller, Get, Param } from '@nestjs/common';
import { IaService } from './ia.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Inteligência Artificial')
@Controller('ia')
export class IaController {
  constructor(private readonly service: IaService) {}

  @Get('analise/:aprendenteId')
  @ApiOperation({
    summary: 'Gera um relatório textual automático',
    description:
      'Analisa os gráficos matemáticos e retorna um texto pedagógico pronto.',
  })
  gerarAnalise(
    @Param('aprendenteId') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.gerarRelatorioComIA(id, user.id);
  }
}
