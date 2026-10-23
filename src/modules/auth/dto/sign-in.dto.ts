import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { CampoEmail } from '../../../common/validation/campos.decorators';
import { LIMITES } from '../../../common/validation/limits.constants';

export class SignInDto {
  @ApiProperty({
    description: 'E-mail cadastrado no sistema',
    example: 'rosilda@sinapse.edu.br',
  })
  @CampoEmail('E-mail', { maximo: LIMITES.EMAIL_LOGIN })
  email!: string;

  @ApiProperty({
    description: 'Senha de acesso',
    example: 'Clc26-0510',
  })
  @IsString()
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  @MinLength(LIMITES.SENHA_MIN, {
    message: `A senha deve ter no mínimo ${LIMITES.SENHA_MIN} caracteres`,
  })
  @MaxLength(LIMITES.SENHA_LOGIN_MAX, {
    message: `Senha: máximo de ${LIMITES.SENHA_LOGIN_MAX} caracteres.`,
  })
  senha!: string;
}
