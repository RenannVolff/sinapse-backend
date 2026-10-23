import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { CampoEmail } from '../../../common/validation/campos.decorators';
import { LIMITES } from '../../../common/validation/limits.constants';

export class LoginDto {
  @ApiProperty({
    description: 'E-mail cadastrado',
    example: 'email@teste.com',
  })
  @CampoEmail('E-mail', { maximo: LIMITES.EMAIL_LOGIN })
  email!: string;

  // Sem regra de força no login: só presença e teto (bcrypt usa 72 bytes)
  @ApiProperty({
    description: 'Senha de acesso',
    example: 'SenhaForte@123',
  })
  @IsString({ message: 'Senha: deve ser um texto.' })
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  @MaxLength(LIMITES.SENHA_LOGIN_MAX, {
    message: `Senha: máximo de ${LIMITES.SENHA_LOGIN_MAX} caracteres.`,
  })
  senha!: string;

  // Honeypot anti-bot: campo escondido via CSS no frontend, nenhum humano
  // preenche. Se vier preenchido, o controller devolve um sucesso falso.
  @ApiHideProperty()
  @IsOptional()
  @IsString()
  @MaxLength(LIMITES.HONEYPOT)
  website?: string;
}
