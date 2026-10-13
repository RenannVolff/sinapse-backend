import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreatePeiDto {
  @ApiProperty({
    description: 'ID do Aprendente vinculado',
    example: '3f2b8c1e-7a4d-4e9b-9c0a-1d2e3f4a5b6c',
  })
  @IsUUID()
  @IsNotEmpty()
  aprendenteId!: string;

  @ApiProperty({
    description: 'Dificuldades identificadas',
    example: 'Dificuldade na discriminação de fonemas surdos e sonoros.',
  })
  @IsString()
  @IsNotEmpty()
  dificuldades!: string;

  @ApiProperty({
    description: 'Objetivos do plano',
    example: 'Ler palavras dissílabas com autonomia até o fim do semestre.',
  })
  @IsString()
  @IsNotEmpty()
  objetivos!: string;

  @ApiProperty({
    description: 'Estratégias de intervenção',
    example: 'Jogos de consciência fonológica e leitura compartilhada.',
  })
  @IsString()
  @IsNotEmpty()
  estrategias!: string;

  @ApiProperty({
    description: 'Data de início do plano (ISO 8601)',
    example: '2026-08-01',
  })
  @IsDateString({}, { message: 'Data inválida' })
  dataInicio!: string;

  @ApiPropertyOptional({
    description: 'Data de fim do plano (ISO 8601)',
    example: '2026-12-15',
  })
  @IsDateString({}, { message: 'Data inválida' })
  @IsOptional()
  dataFim?: string;

  @ApiPropertyOptional({
    description:
      'ID do PeiTemplate de origem, se o plano foi criado a partir de um molde',
    example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
  })
  @IsUUID()
  @IsOptional()
  templateOrigemId?: string;
}
