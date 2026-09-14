import { Body, Controller, Param, Post, StreamableFile } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import { ExportarDocxDto } from './dto/exportar-docx.dto';
import { ExportacaoService } from './exportacao.service';

@ApiTags('Exportação')
@Controller('aprendentes/:id/exportar-docx')
export class ExportacaoController {
  constructor(private readonly exportacaoService: ExportacaoService) {}

  @Post()
  @ApiOperation({
    summary: 'Gera um relatório .docx com o texto da IA e os gráficos capturados',
  })
  async exportarDocx(
    @Param('id') id: string,
    @Body() dto: ExportarDocxDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StreamableFile> {
    const { buffer, nomeArquivo } = await this.exportacaoService.gerarDocx(
      id,
      dto,
      user.id,
    );

    return new StreamableFile(buffer, {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      disposition: `attachment; filename="${nomeArquivo}"`,
    });
  }
}
