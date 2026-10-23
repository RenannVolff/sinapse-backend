import { ApiProperty } from '@nestjs/swagger';
import {
  CampoDataDia,
  CampoNomePessoa,
  CampoTelefone,
} from '../../../common/validation/campos.decorators';
import { LIMITES } from '../../../common/validation/limits.constants';

// DTO para criar um novo aprendente
export class CreateAprendenteDto {
  @ApiProperty({
    description: 'Nome completo do aprendente',
    example: 'Maria Souza',
    maxLength: LIMITES.NOME_PESSOA,
  })
  @CampoNomePessoa('Nome completo')
  nomeCompleto!: string;

  @ApiProperty({
    description: `Data de nascimento (AAAA-MM-DD), sem data futura nem anterior a ${LIMITES.IDADE_MAX_ANOS} anos`,
    example: '2017-03-15',
  })
  @CampoDataDia('Data de nascimento', {
    naoFutura: true,
    anosAtrasMax: LIMITES.IDADE_MAX_ANOS,
  })
  dataNascimento!: string;

  @ApiProperty({
    description: 'Nome do responsável legal',
    example: 'Ana Souza',
    maxLength: LIMITES.NOME_PESSOA,
  })
  @CampoNomePessoa('Responsável')
  responsavel!: string;

  @ApiProperty({
    description: 'Telefone do responsável',
    example: '(47) 99999-0000',
    maxLength: LIMITES.TELEFONE,
  })
  @CampoTelefone('Contato')
  contato!: string;
}
