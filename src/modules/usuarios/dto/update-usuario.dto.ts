import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUsuarioDto {
  @ApiPropertyOptional({
    description: 'Nome do profissional',
    example: 'João Silva',
  })
  @IsOptional()
  @IsString({ message: 'O nome deve ser um texto válido.' })
  nome?: string;

  @ApiPropertyOptional({
    description: 'E-mail de acesso',
    example: 'admin@sinapse.edu.br',
  })
  @IsOptional()
  @IsEmail({}, { message: 'O e-mail fornecido não tem um formato válido.' })
  email?: string;

  @ApiPropertyOptional({ description: 'Nova senha de acesso', minLength: 6 })
  @IsOptional()
  @IsString({ message: 'A senha deve ser um texto válido.' })
  @MinLength(8, { message: 'A senha deve conter no mínimo 8 caracteres.' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
    message:
      'A senha deve conter pelo menos 1 letra maiúscula, 1 minúscula, 1 número e 1 caractere especial',
  })
  senha?: string;
}
