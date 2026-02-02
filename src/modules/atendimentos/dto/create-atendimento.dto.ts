import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateAtendimentoDto {
  @ApiProperty({ description: 'ID do Aluno vinculado' })
  @IsUUID()
  @IsNotEmpty()
  alunoId: string;

  @ApiProperty({ description: 'Data e Hora do atendimento' })
  @IsDateString()
  @IsNotEmpty()
  dataAtendimento: string;

  @ApiProperty({ description: 'Título da Sessão' })
  @IsString()
  @IsNotEmpty()
  tituloSessao: string;

  @ApiPropertyOptional({ description: 'Observações preliminares' })
  @IsString()
  @IsOptional()
  observacoes?: string;
}
