import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateAlunoDto {
  @ApiProperty({ description: 'Nome completo do aluno/paciente' })
  @IsString()
  @IsNotEmpty()
  nomeCompleto: string;

  @ApiProperty({ description: 'Data de nascimento (Formato ISO 8601)' })
  @IsDateString({}, { message: 'Data inválida' })
  dataNascimento: string;

  @ApiProperty({ description: 'Nome do responsável legal' })
  @IsString()
  @IsNotEmpty()
  responsavel: string;

  @ApiProperty({ description: 'Contato do responsável' })
  @IsString()
  @IsNotEmpty()
  contato: string;

  @ApiProperty({ description: 'ID do Profissional responsável' })
  @IsUUID(undefined, { message: 'ID de usuário inválido' })
  @IsNotEmpty()
  usuarioId: string;
}
