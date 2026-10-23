import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsUUID } from 'class-validator';
import { CampoTexto } from '../../../common/validation/campos.decorators';
import { LIMITES } from '../../../common/validation/limits.constants';

const NIVEIS_DIFICULDADE = [1, 2, 3, 4, 5];
const MENSAGEM_NIVEL =
  'O nível de dificuldade deve ser um número inteiro de 1 a 5.';

// Atividade avaliada dentro de um atendimento; a criação já gera as 5
// tentativas do checklist.
export class CreateAtividadeDto {
  @ApiProperty({
    description: 'ID do Atendimento vinculado',
    example: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  })
  @IsNotEmpty({ message: 'O identificador do atendimento é obrigatório.' })
  @IsUUID('all', { message: 'O identificador do atendimento é inválido.' })
  atendimentoId!: string;

  @ApiProperty({
    description: 'Título da atividade',
    example: 'Rimas com figuras',
    maxLength: LIMITES.TITULO,
  })
  @CampoTexto('Título da atividade', LIMITES.TITULO)
  titulo!: string;

  // Mesmo intervalo do seletor do frontend (1 - Iniciante ... 5 - Avançado).
  // É o peso da atividade no score ponderado da sessão.
  @ApiProperty({
    description: 'Nível de dificuldade (1 a 5)',
    minimum: LIMITES.NIVEL_DIFICULDADE_MIN,
    maximum: LIMITES.NIVEL_DIFICULDADE_MAX,
    example: 3,
  })
  // Um único validador (e não IsInt + Min + Max) para o erro sair uma vez só;
  // a comparação é estrita, então "3", 2.5 e 0 são recusados.
  @IsIn(NIVEIS_DIFICULDADE, { message: MENSAGEM_NIVEL })
  nivelDificuldade!: number;

  @ApiPropertyOptional({
    description: 'Observação geral final',
    example: 'Precisou de apoio visual nas duas primeiras tentativas.',
    maxLength: LIMITES.TEXTO_MEDIO,
  })
  @CampoTexto('Observação', LIMITES.TEXTO_MEDIO, {
    obrigatorio: false,
    permitirVazio: true,
  })
  observacao?: string;
}
