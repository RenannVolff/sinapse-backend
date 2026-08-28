import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

// aprendenteId e templateOrigemId não são atualizáveis: o vínculo com o
// aprendente e a origem do plano são definidos na criação.
export class UpdatePeiDto {
  @ApiPropertyOptional({ description: 'Dificuldades identificadas' })
  @IsString()
  @IsOptional()
  dificuldades?: string;

  @ApiPropertyOptional({ description: 'Objetivos do plano' })
  @IsString()
  @IsOptional()
  objetivos?: string;

  @ApiPropertyOptional({ description: 'Estratégias de intervenção' })
  @IsString()
  @IsOptional()
  estrategias?: string;

  @ApiPropertyOptional({ description: 'Data de início do plano (ISO 8601)' })
  @IsDateString({}, { message: 'Data inválida' })
  @IsOptional()
  dataInicio?: string;

  @ApiPropertyOptional({ description: 'Data de fim do plano (ISO 8601)' })
  @IsDateString({}, { message: 'Data inválida' })
  @IsOptional()
  dataFim?: string;
}
