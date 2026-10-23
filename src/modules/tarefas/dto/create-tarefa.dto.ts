import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CampoTexto } from '../../../common/validation/campos.decorators';
import { LIMITES } from '../../../common/validation/limits.constants';

export class CreateTarefaDto {
  @ApiProperty({
    description: 'Título curto da tarefa',
    example: 'Preparar material da sessão de quinta',
    maxLength: LIMITES.TITULO,
  })
  @CampoTexto('Tarefa', LIMITES.TITULO)
  texto!: string;

  @ApiPropertyOptional({
    description: 'Anotação livre sobre a tarefa',
    example: 'Imprimir fichas de rimas',
    maxLength: LIMITES.TEXTO_MEDIO,
  })
  @CampoTexto('Notas', LIMITES.TEXTO_MEDIO, {
    obrigatorio: false,
    permitirVazio: true,
  })
  notas?: string;
}
