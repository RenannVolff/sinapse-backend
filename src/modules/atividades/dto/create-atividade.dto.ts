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
// Este DTO é usado para criar uma nova atividade, que é uma tarefa ou exercício recomendado para o aluno após um atendimento.
// Ele inclui o ID do atendimento vinculado, um título para a atividade, um nível de dificuldade e uma observação opcional.
export class CreateAtividadeDto {
  @ApiProperty({ description: 'ID do Atendimento vinculado' })
  @IsUUID()
  @IsNotEmpty()
  atendimentoId: string;
  /// O título da atividade é obrigatório e deve ser uma string não vazia.
  @ApiProperty({ description: 'Título da atividade' })
  @IsString()
  @IsNotEmpty()
  titulo: string;
  /// O nível de dificuldade é um número inteiro entre 1 e 5, onde 1 é o mais fácil e 5 o mais difícil.
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
