import { ApiPropertyOptional } from '@nestjs/swagger';
import { CampoOpcao } from '../../../common/validation/campos.decorators';
import {
  DIRECOES_ORDENACAO,
  type DirecaoOrdenacao,
} from '../../../common/utils/ordenacao';

// Campos aceitos em `sortBy`: name = nome do aprendente, guardianName = nome
// do responsável, contact = telefone de contato. Qualquer outro valor é 400.
export const ORDENACOES_APRENDENTE = [
  'name',
  'guardianName',
  'contact',
] as const;
export type OrdenacaoAprendente = (typeof ORDENACOES_APRENDENTE)[number];

// Sem parâmetros: ordem alfabética crescente pelo nome do aprendente.
export class ListarAprendentesQueryDto {
  @ApiPropertyOptional({
    enum: ORDENACOES_APRENDENTE,
    default: 'name',
    description:
      'Campo de ordenação: name (aprendente), guardianName (responsável) ou contact (telefone)',
  })
  @CampoOpcao('Ordenar por', ORDENACOES_APRENDENTE, { obrigatorio: false })
  sortBy?: OrdenacaoAprendente;

  @ApiPropertyOptional({
    enum: DIRECOES_ORDENACAO,
    default: 'asc',
    description: 'Direção da ordenação',
  })
  @CampoOpcao('Direção', DIRECOES_ORDENACAO, { obrigatorio: false })
  order?: DirecaoOrdenacao;
}
