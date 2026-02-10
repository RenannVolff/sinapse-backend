import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateUsuarioDto {
  @ApiProperty({ description: 'Nome completo do profissional' })
  @IsString()
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  nome: string;

  @ApiProperty({ description: 'E-mail para login no sistema' })
  @IsEmail({}, { message: 'Forneça um e-mail válido' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description:
      'Senha forte (Mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número e 1 especial)',
    example: 'SenhaForte@123',
  })
  @IsString()
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'A senha deve conter pelo menos 1 letra maiúscula, 1 minúscula, 1 número e 1 caractere especial',
  })
  senha: string;
}
