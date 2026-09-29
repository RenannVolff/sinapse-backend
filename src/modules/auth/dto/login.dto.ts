import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'E-mail cadastrado',
    example: 'email@teste.com',
  })
  @IsEmail({}, { message: 'E-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  email!: string;

  @ApiProperty({
    description: 'Senha de acesso',
    example: 'SenhaForte@123',
  })
  @IsString()
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  senha!: string;

  // Honeypot anti-bot: campo escondido via CSS no frontend, nenhum humano
  // preenche. Se vier preenchido, o controller devolve um sucesso falso.
  @ApiHideProperty()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;
}
