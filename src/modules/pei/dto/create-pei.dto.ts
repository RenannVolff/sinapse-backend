import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import {
  CampoDataDia,
  CampoTexto,
} from '../../../common/validation/campos.decorators';
import { LIMITES } from '../../../common/validation/limits.constants';

// Coerência entre as datas (início ≤ fim) é checada no PeiService, que
// também enxerga as datas já gravadas numa edição parcial.
export class CreatePeiDto {
  @ApiProperty({
    description: 'ID do Aprendente vinculado',
    example: '3f2b8c1e-7a4d-4e9b-9c0a-1d2e3f4a5b6c',
  })
  @IsNotEmpty({ message: 'Aprendente: campo obrigatório.' })
  @IsUUID('all', { message: 'Aprendente: identificador inválido.' })
  aprendenteId!: string;

  @ApiProperty({
    description: 'Dificuldades identificadas',
    example: 'Dificuldade na discriminação de fonemas surdos e sonoros.',
    maxLength: LIMITES.TEXTO_LONGO,
  })
  @CampoTexto('Dificuldades', LIMITES.TEXTO_LONGO)
  dificuldades!: string;

  @ApiProperty({
    description: 'Objetivos do plano',
    example: 'Ler palavras dissílabas com autonomia até o fim do semestre.',
    maxLength: LIMITES.TEXTO_LONGO,
  })
  @CampoTexto('Objetivos', LIMITES.TEXTO_LONGO)
  objetivos!: string;

  @ApiProperty({
    description: 'Estratégias de intervenção',
    example: 'Jogos de consciência fonológica e leitura compartilhada.',
    maxLength: LIMITES.TEXTO_LONGO,
  })
  @CampoTexto('Estratégias', LIMITES.TEXTO_LONGO)
  estrategias!: string;

  @ApiProperty({
    description: 'Data de início do plano (AAAA-MM-DD)',
    example: '2026-08-01',
  })
  @CampoDataDia('Data de início', {
    minimo: LIMITES.DATA_MIN,
    maximo: LIMITES.DATA_MAX,
  })
  dataInicio!: string;

  @ApiPropertyOptional({
    description:
      'Data de fim do plano (AAAA-MM-DD), igual ou posterior ao início; null remove na edição',
    example: '2026-12-15',
  })
  @CampoDataDia('Data de fim', {
    obrigatorio: false,
    minimo: LIMITES.DATA_MIN,
    maximo: LIMITES.DATA_MAX,
  })
  dataFim?: string | null;

  @ApiPropertyOptional({
    description:
      'ID do PeiTemplate de origem, se o plano foi criado a partir de um molde',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  @IsOptional()
  @IsUUID('all', { message: 'Molde de origem: identificador inválido.' })
  templateOrigemId?: string;
}
