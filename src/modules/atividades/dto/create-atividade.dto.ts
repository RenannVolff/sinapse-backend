import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateAtividadeDto {
  @ApiProperty({ description: 'ID do Atendimento vinculado' })
  @IsUUID()
  @IsNotEmpty()
  atendimentoId: string;

  @ApiProperty({ description: 'Título da atividade' })
  @IsString()
  @IsNotEmpty()
  titulo: string;

  @ApiProperty({ description: 'Nível de dificuldade (1 a 5)' })
  @IsInt()
  @Min(1)
  @Max(5)
  nivelDificuldade: number;

  @ApiPropertyOptional({ description: 'Observação geral final' })
  @IsString()
  @IsOptional()
  observacao?: string;
}
