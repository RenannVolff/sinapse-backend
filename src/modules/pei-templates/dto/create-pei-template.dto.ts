import { ApiProperty } from '@nestjs/swagger';
import { CampoTexto } from '../../../common/validation/campos.decorators';
import { LIMITES } from '../../../common/validation/limits.constants';

export class CreatePeiTemplateDto {
  @ApiProperty({
    description: 'Nome do molde de PEI',
    maxLength: LIMITES.TITULO,
  })
  @CampoTexto('Nome do molde', LIMITES.TITULO)
  nome!: string;

  @ApiProperty({
    description: 'Dificuldades padrão do molde',
    maxLength: LIMITES.TEXTO_LONGO,
  })
  @CampoTexto('Dificuldades', LIMITES.TEXTO_LONGO)
  dificuldades!: string;

  @ApiProperty({
    description: 'Objetivos padrão do molde',
    maxLength: LIMITES.TEXTO_LONGO,
  })
  @CampoTexto('Objetivos', LIMITES.TEXTO_LONGO)
  objetivos!: string;

  @ApiProperty({
    description: 'Estratégias padrão do molde',
    maxLength: LIMITES.TEXTO_LONGO,
  })
  @CampoTexto('Estratégias', LIMITES.TEXTO_LONGO)
  estrategias!: string;
}
