import { ApiProperty } from '@nestjs/swagger';
import { CampoEmail } from '../../../common/validation/campos.decorators';
import { LIMITES } from '../../../common/validation/limits.constants';

export class EsqueciSenhaDto {
  @ApiProperty({ description: 'E-mail cadastrado' })
  @CampoEmail('E-mail', { maximo: LIMITES.EMAIL_LOGIN })
  email!: string;
}
