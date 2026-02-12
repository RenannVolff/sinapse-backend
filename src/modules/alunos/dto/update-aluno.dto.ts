import { PartialType } from '@nestjs/mapped-types';
import { CreateAlunoDto } from './create-aluno.dto';

// DTO para atualizar um aluno/aprendente (todos os campos opcionais)
export class UpdateAlunoDto extends PartialType(CreateAlunoDto) {}
