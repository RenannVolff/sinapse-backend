import { ApiPropertyOptional } from '@nestjs/swagger';
import { CampoOpcao } from '../../../common/validation/campos.decorators';
import {
  DIRECOES_ORDENACAO,
  type DirecaoOrdenacao,
} from '../../../common/utils/ordenacao';

// Campos aceitos em `sortBy`: title = título do molde (coluna `nome`).
export const ORDENACOES_PEI_TEMPLATE = ['title'] as const;
export type OrdenacaoPeiTemplate = (typeof ORDENACOES_PEI_TEMPLATE)[number];

// Sem parâmetros: ordem alfabética crescente pelo título.
export class ListarPeiTemplatesQueryDto {
  @ApiPropertyOptional({
    enum: ORDENACOES_PEI_TEMPLATE,
    default: 'title',
    description: 'Campo de ordenação: title (título do molde)',
  })
  @CampoOpcao('Ordenar por', ORDENACOES_PEI_TEMPLATE, { obrigatorio: false })
  sortBy?: OrdenacaoPeiTemplate;

  @ApiPropertyOptional({
    enum: DIRECOES_ORDENACAO,
    default: 'asc',
    description: 'Direção da ordenação',
  })
  @CampoOpcao('Direção', DIRECOES_ORDENACAO, { obrigatorio: false })
  order?: DirecaoOrdenacao;
}
