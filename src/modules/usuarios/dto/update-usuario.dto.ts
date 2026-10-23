import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional } from 'class-validator';
import { SenhaForte } from '../../../common/validators/senha-forte.decorator';
import {
  CampoEmail,
  CampoNomePessoa,
} from '../../../common/validation/campos.decorators';
import { LIMITES } from '../../../common/validation/limits.constants';

// Configurações da conta: cada campo é opcional, mas quando enviado segue as
// mesmas regras e limites do cadastro.
export class UpdateUsuarioDto {
  @ApiPropertyOptional({
    description: 'Nome do profissional',
    example: 'João Silva',
    maxLength: LIMITES.NOME_PESSOA,
  })
  @CampoNomePessoa('Nome', { obrigatorio: false })
  nome?: string;

  @ApiPropertyOptional({
    description: 'E-mail de acesso',
    example: 'admin@sinapse.edu.br',
    maxLength: LIMITES.EMAIL,
  })
  @CampoEmail('E-mail', { obrigatorio: false, verificarDominio: true })
  email?: string;

  @ApiPropertyOptional({
    description: 'Nova senha de acesso',
    minLength: LIMITES.SENHA_MIN,
    maxLength: LIMITES.SENHA_MAX,
  })
  @IsOptional()
  @SenhaForte()
  senha?: string;
}
