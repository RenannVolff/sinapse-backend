import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { LIMITES } from '../../../common/validation/limits.constants';

export class DesativarDoisFatoresDto {
  @ApiProperty({ description: 'Senha atual, para reconfirmar a identidade' })
  @IsString()
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  @MaxLength(LIMITES.SENHA_LOGIN_MAX, {
    message: `Senha: máximo de ${LIMITES.SENHA_LOGIN_MAX} caracteres.`,
  })
  senha!: string;
}
