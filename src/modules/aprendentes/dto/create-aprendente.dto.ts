import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

// DTO para criar um novo aprendente
export class CreateAprendenteDto {
  @ApiProperty({ description: 'Nome completo do aprendente' })
  @IsString()
  @IsNotEmpty()
  nomeCompleto!: string;
  // Adicionando o campo de data de nascimento
  @ApiProperty({ description: 'Data de nascimento (Formato ISO 8601)' })
  @IsDateString({}, { message: 'Data inválida' })
  dataNascimento!: string;
  // Campo para o nome do responsável legal
  @ApiProperty({ description: 'Nome do responsável legal' })
  @IsString()
  @IsNotEmpty()
  responsavel!: string;
  // Campo para contato do responsável
  @ApiProperty({ description: 'Contato do responsável' })
  @IsString()
  @IsNotEmpty()
  contato!: string;
}
