import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTarefaDto {
  @ApiProperty({ description: 'Título curto da tarefa' })
  @IsString()
  @IsNotEmpty()
  texto!: string;

  @ApiPropertyOptional({ description: 'Anotação livre sobre a tarefa' })
  @IsString()
  @IsOptional()
  notas?: string;
}
