import { PartialType } from '@nestjs/mapped-types';
import { CreateAprendenteDto } from './create-aprendente.dto';

// DTO para atualizar um aprendente (todos os campos opcionais)
export class UpdateAprendenteDto extends PartialType(CreateAprendenteDto) {}
