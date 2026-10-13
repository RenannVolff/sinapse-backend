import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateTarefaDto {
  @ApiPropertyOptional({
    description: 'Título curto da tarefa',
    example: 'Preparar material da sessão de quinta',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  texto?: string;

  @ApiPropertyOptional({
    description: 'Anotação livre sobre a tarefa',
    example: 'Imprimir fichas de rimas',
  })
  @IsString()
  @IsOptional()
  notas?: string;

  @ApiPropertyOptional({
    description: 'Se a tarefa está concluída',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  concluida?: boolean;
}
