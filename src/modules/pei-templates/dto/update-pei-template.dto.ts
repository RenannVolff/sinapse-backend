import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdatePeiTemplateDto {
  @ApiPropertyOptional({ description: 'Nome do molde de PEI' })
  @IsString()
  @IsOptional()
  nome?: string;

  @ApiPropertyOptional({ description: 'Dificuldades padrão do molde' })
  @IsString()
  @IsOptional()
  dificuldades?: string;

  @ApiPropertyOptional({ description: 'Objetivos padrão do molde' })
  @IsString()
  @IsOptional()
  objetivos?: string;

  @ApiPropertyOptional({ description: 'Estratégias padrão do molde' })
  @IsString()
  @IsOptional()
  estrategias?: string;
}
