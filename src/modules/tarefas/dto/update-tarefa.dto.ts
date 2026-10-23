import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CampoTexto } from '../../../common/validation/campos.decorators';
import { LIMITES } from '../../../common/validation/limits.constants';

export class UpdateTarefaDto {
  @ApiPropertyOptional({
    description: 'Título curto da tarefa',
    example: 'Preparar material da sessão de quinta',
    maxLength: LIMITES.TITULO,
  })
  @CampoTexto('Tarefa', LIMITES.TITULO, { obrigatorio: false })
  texto?: string;

  @ApiPropertyOptional({
    description: 'Anotação livre sobre a tarefa (vazio apaga a nota)',
    example: 'Imprimir fichas de rimas',
    maxLength: LIMITES.TEXTO_MEDIO,
  })
  @CampoTexto('Notas', LIMITES.TEXTO_MEDIO, {
    obrigatorio: false,
    permitirVazio: true,
  })
  notas?: string;

  @ApiPropertyOptional({
    description: 'Se a tarefa está concluída',
    example: false,
  })
  @IsBoolean({ message: 'Concluída: deve ser verdadeiro ou falso.' })
  @IsOptional()
  concluida?: boolean;
}
