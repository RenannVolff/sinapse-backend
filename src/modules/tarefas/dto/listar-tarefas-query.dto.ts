import { ApiPropertyOptional } from '@nestjs/swagger';
import { CampoInteiro } from '../../../common/validation/campos.decorators';
import { LIMITES } from '../../../common/validation/limits.constants';

// Paginação opcional. Sem nenhum dos dois parâmetros, a listagem devolve
// todas as tarefas (formato de lista simples, compatível com o front atual).
export class ListarTarefasQueryDto {
  @ApiPropertyOptional({ description: 'Página (começa em 1)', example: 1 })
  @CampoInteiro('Página', 1, LIMITES.PAGINA_MAX, {
    obrigatorio: false,
    daQuery: true,
  })
  pagina?: number;

  @ApiPropertyOptional({
    description: `Itens por página (1 a ${LIMITES.POR_PAGINA_MAX})`,
    example: 20,
  })
  @CampoInteiro('Itens por página', 1, LIMITES.POR_PAGINA_MAX, {
    obrigatorio: false,
    daQuery: true,
  })
  porPagina?: number;
}
