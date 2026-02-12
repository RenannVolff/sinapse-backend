import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
// DTO para criação de um novo atendimento
export class CreateAtendimentoDto {
  @ApiProperty({ description: 'ID do Aluno vinculado' })
  @IsUUID()
  @IsNotEmpty()
  alunoId: string;
  // O campo de data e hora deve ser uma string no formato ISO 8601, por exemplo: "2024-06-30T14:30:00Z"
  @ApiProperty({ description: 'Data e Hora do atendimento' })
  @IsDateString()
  @IsNotEmpty()
  dataAtendimento: string;
  // O título da sessão é obrigatório para facilitar a identificação do atendimento posteriormente
  @ApiProperty({ description: 'Título da Sessão' })
  @IsString()
  @IsNotEmpty()
  tituloSessao: string;
  // O campo de observações é opcional, permitindo que o profissional adicione informações adicionais sobre o atendimento, caso necessário
  @ApiPropertyOptional({ description: 'Observações preliminares' })
  @IsString()
  @IsOptional()
  observacoes?: string;
}
