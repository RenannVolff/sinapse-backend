import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePeiDto } from './create-pei.dto';

// aprendenteId e templateOrigemId não são atualizáveis: o vínculo com o
// aprendente e a origem do plano são definidos na criação. Os demais campos
// são opcionais, com as mesmas validações e limites da criação.
export class UpdatePeiDto extends PartialType(
  OmitType(CreatePeiDto, ['aprendenteId', 'templateOrigemId'] as const),
) {}
