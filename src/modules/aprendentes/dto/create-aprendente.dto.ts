import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString } from 'class-validator';

// DTO para criar um novo aprendente
export class CreateAprendenteDto {
  @ApiProperty({
    description: 'Nome completo do aprendente',
    example: 'Maria Souza',
  })
  @IsString()
  @IsNotEmpty()
  nomeCompleto!: string;
  // Adicionando o campo de data de nascimento
  @ApiProperty({
    description: 'Data de nascimento (Formato ISO 8601)',
    example: '2017-03-15',
  })
  @IsDateString({}, { message: 'Data inválida' })
  dataNascimento!: string;
  // Campo para o nome do responsável legal
  @ApiProperty({
    description: 'Nome do responsável legal',
    example: 'Ana Souza',
  })
  @IsString()
  @IsNotEmpty()
  responsavel!: string;
  // Campo para contato do responsável
  @ApiProperty({
    description: 'Contato do responsável',
    example: '(47) 99999-0000',
  })
  @IsString()
  @IsNotEmpty()
  contato!: string;
}
