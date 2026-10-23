import { PartialType } from '@nestjs/swagger';
import { CreatePeiTemplateDto } from './create-pei-template.dto';

// Edição parcial com as mesmas validações e limites da criação (campo
// enviado não pode ficar vazio).
export class UpdatePeiTemplateDto extends PartialType(CreatePeiTemplateDto) {}
