import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';
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
  @MinLength(6, { message: 'A senha deve conter no mínimo 6 caracteres.' })
  senha?: string;
}
