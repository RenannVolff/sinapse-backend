import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, IsUUID } from 'class-validator';

// DTO para criar um novo aluno/aprendente
export class CreateAlunoDto {
  @ApiProperty({ description: 'Nome completo do aluno/aprendente' })
  @IsString()
  @IsNotEmpty()
  nomeCompleto: string;
  // Adicionando o campo de data de nascimento
  @ApiProperty({ description: 'Data de nascimento (Formato ISO 8601)' })
  @IsDateString({}, { message: 'Data inválida' })
  dataNascimento: string;
  // Campo para o nome do responsável legal
  @ApiProperty({ description: 'Nome do responsável legal' })
  @IsString()
  @IsNotEmpty()
  responsavel: string;
  // Campo para contato do responsável
  @ApiProperty({ description: 'Contato do responsável' })
  @IsString()
  @IsNotEmpty()
  contato: string;
  // Campo para o ID do profissional responsável (Relacionamento)
  @ApiProperty({ description: 'ID do Profissional responsável' })
  @IsUUID(undefined, { message: 'ID de usuário inválido' })
  @IsNotEmpty()
  usuarioId: string;
}
