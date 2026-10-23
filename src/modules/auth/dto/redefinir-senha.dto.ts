import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { LIMITES } from '../../../common/validation/limits.constants';
import { SenhaForte } from '../../../common/validators/senha-forte.decorator';

export class RedefinirSenhaDto {
  @ApiProperty({ description: 'Token de recuperação recebido por e-mail' })
  @IsString()
  @IsNotEmpty({ message: 'O token é obrigatório' })
  @MaxLength(LIMITES.TOKEN, { message: 'Token: formato inválido.' })
  token!: string;

  @ApiProperty({
    description:
      'Nova senha forte (Mínimo 8 caracteres, 1 maiúscula, 1 minúscula, 1 número e 1 especial)',
    example: 'SenhaForte@123',
  })
  @SenhaForte()
  novaSenha!: string;
}
