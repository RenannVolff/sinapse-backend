import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { SenhaForte } from '../../../common/validators/senha-forte.decorator';
import {
  CampoEmail,
  CampoNomePessoa,
} from '../../../common/validation/campos.decorators';
import { LIMITES } from '../../../common/validation/limits.constants';

export class CreateUsuarioDto {
  @ApiProperty({
    description: 'Nome completo do profissional',
    maxLength: LIMITES.NOME_PESSOA,
  })
  @CampoNomePessoa('Nome')
  nome!: string;

  @ApiProperty({
    description:
      'E-mail para login (domínio precisa existir; e-mail temporário é recusado)',
    maxLength: LIMITES.EMAIL,
  })
  @CampoEmail('E-mail', { verificarDominio: true })
  email!: string;

  @ApiProperty({
    description:
      'Senha forte (8 a 50 caracteres, 1 maiúscula, 1 minúscula, 1 número ou especial)',
    example: 'SenhaForte@123',
    minLength: LIMITES.SENHA_MIN,
    maxLength: LIMITES.SENHA_MAX,
  })
  @SenhaForte()
  senha!: string;

  // Honeypot anti-bot: campo escondido via CSS no frontend, nenhum humano
  // preenche. Se vier preenchido, o controller devolve um sucesso falso.
  @ApiHideProperty()
  @IsOptional()
  @IsString()
  @MaxLength(LIMITES.HONEYPOT)
  website?: string;
}
