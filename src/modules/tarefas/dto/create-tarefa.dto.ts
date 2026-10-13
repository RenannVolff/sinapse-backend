import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTarefaDto {
  @ApiProperty({
    description: 'Título curto da tarefa',
    example: 'Preparar material da sessão de quinta',
  })
  @IsString()
  @IsNotEmpty()
  texto!: string;

  @ApiPropertyOptional({
    description: 'Anotação livre sobre a tarefa',
    example: 'Imprimir fichas de rimas',
  })
  @IsString()
  @IsOptional()
  notas?: string;
}
