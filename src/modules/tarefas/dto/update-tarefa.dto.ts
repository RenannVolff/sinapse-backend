import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateTarefaDto {
  @ApiPropertyOptional({ description: 'Título curto da tarefa' })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  texto?: string;

  @ApiPropertyOptional({ description: 'Anotação livre sobre a tarefa' })
  @IsString()
  @IsOptional()
  notas?: string;

  @ApiPropertyOptional({ description: 'Se a tarefa está concluída' })
  @IsBoolean()
  @IsOptional()
  concluida?: boolean;
}
