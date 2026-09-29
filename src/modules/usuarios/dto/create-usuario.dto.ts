import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SenhaForte } from '../../../common/validators/senha-forte.decorator';

export class CreateUsuarioDto {
  @ApiProperty({ description: 'Nome completo do profissional' })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  nome!: string;

  @ApiProperty({ description: 'E-mail para login no sistema' })
  @IsEmail({}, { message: 'Forneça um e-mail válido' })
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    description:
      'Senha forte (Mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número e 1 especial)',
    example: 'SenhaForte@123',
  })
  @SenhaForte()
  senha!: string;

  // Honeypot anti-bot: campo escondido via CSS no frontend, nenhum humano
  // preenche. Se vier preenchido, o controller devolve um sucesso falso.
  @ApiHideProperty()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;
}
