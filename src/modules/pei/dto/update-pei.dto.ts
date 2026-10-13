import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

// aprendenteId e templateOrigemId não são atualizáveis: o vínculo com o
// aprendente e a origem do plano são definidos na criação.
export class UpdatePeiDto {
  @ApiPropertyOptional({
    description: 'Dificuldades identificadas',
    example: 'Dificuldade na discriminação de fonemas surdos e sonoros.',
  })
  @IsString()
  @IsOptional()
  dificuldades?: string;

  @ApiPropertyOptional({
    description: 'Objetivos do plano',
    example: 'Ler palavras dissílabas com autonomia até o fim do semestre.',
  })
  @IsString()
  @IsOptional()
  objetivos?: string;

  @ApiPropertyOptional({
    description: 'Estratégias de intervenção',
    example: 'Jogos de consciência fonológica e leitura compartilhada.',
  })
  @IsString()
  @IsOptional()
  estrategias?: string;

  @ApiPropertyOptional({
    description: 'Data de início do plano (ISO 8601)',
    example: '2026-08-01',
  })
  @IsDateString({}, { message: 'Data inválida' })
  @IsOptional()
  dataInicio?: string;

  @ApiPropertyOptional({
    description: 'Data de fim do plano (ISO 8601)',
    example: '2026-12-15',
  })
  @IsDateString({}, { message: 'Data inválida' })
  @IsOptional()
  dataFim?: string;
}
