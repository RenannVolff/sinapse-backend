import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { LIMITES } from '../../../common/validation/limits.constants';

export class VerificarLoginDoisFatoresDto {
  @ApiProperty({
    description: 'Token temporário devolvido pelo /auth/login',
    example:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIuLi4ifQ.assinatura',
  })
  @IsString()
  @IsNotEmpty({ message: 'O token temporário é obrigatório' })
  @MaxLength(LIMITES.TOKEN_JWT, {
    message: 'Token temporário: formato inválido.',
  })
  tokenTemporario!: string;

  @ApiProperty({
    description: 'Código de 6 dígitos do app autenticador ou código de backup',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'O código é obrigatório' })
  @MaxLength(LIMITES.CODIGO_2FA, {
    message: `Código: máximo de ${LIMITES.CODIGO_2FA} caracteres.`,
  })
  codigo!: string;
}
