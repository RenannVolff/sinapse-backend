import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreatePeiDto {
  @ApiProperty({ description: 'ID do Aprendente vinculado' })
  @IsUUID()
  @IsNotEmpty()
  aprendenteId!: string;

  @ApiProperty({ description: 'Dificuldades identificadas' })
  @IsString()
  @IsNotEmpty()
  dificuldades!: string;

  @ApiProperty({ description: 'Objetivos do plano' })
  @IsString()
  @IsNotEmpty()
  objetivos!: string;

  @ApiProperty({ description: 'Estratégias de intervenção' })
  @IsString()
  @IsNotEmpty()
  estrategias!: string;

  @ApiProperty({ description: 'Data de início do plano (ISO 8601)' })
  @IsDateString({}, { message: 'Data inválida' })
  dataInicio!: string;

  @ApiPropertyOptional({ description: 'Data de fim do plano (ISO 8601)' })
  @IsDateString({}, { message: 'Data inválida' })
  @IsOptional()
  dataFim?: string;

  @ApiPropertyOptional({
    description: 'ID do PeiTemplate de origem, se o plano foi criado a partir de um molde',
  })
  @IsUUID()
  @IsOptional()
  templateOrigemId?: string;
}
