import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SignInDto {
  @ApiProperty({
    description: 'E-mail cadastrado no sistema',
    example: 'rosilda@sinapse.edu.br',
  })
  @IsEmail({}, { message: 'Informe um endereço de e-mail válido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email!: string;

  @ApiProperty({
    description: 'Senha de acesso',
    example: 'Clc26-0510',
  })
  @IsString()
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  @MinLength(8, { message: 'A senha deve ter no mínimo 8 caracteres' })
  senha!: string;
}
