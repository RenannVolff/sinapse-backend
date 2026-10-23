import { PartialType } from '@nestjs/swagger';
import { CreateAprendenteDto } from './create-aprendente.dto';

// DTO para editar um aprendente: todos os campos opcionais, mas cada campo
// enviado passa pelas mesmas validações e limites do cadastro.
export class UpdateAprendenteDto extends PartialType(CreateAprendenteDto) {}
