import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { LIMITES } from '../../../common/validation/limits.constants';

export class VerificarEmailDto {
  @ApiProperty({ description: 'Token de verificação recebido por e-mail' })
  @IsString()
  @IsNotEmpty({ message: 'O token é obrigatório' })
  @MaxLength(LIMITES.TOKEN, { message: 'Token: formato inválido.' })
  token!: string;
}
