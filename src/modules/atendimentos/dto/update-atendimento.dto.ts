import { PartialType } from '@nestjs/mapped-types';
import { CreateAtendimentoDto } from './create-atendimento.dto';
// O PartialType é uma função que recebe um DTO e torna todas as suas propriedades opcionais, ideal para o Update
export class UpdateAtendimentoDto extends PartialType(CreateAtendimentoDto) {}
