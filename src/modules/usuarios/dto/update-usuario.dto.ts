import { IsString, IsEmail, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SenhaForte } from '../../../common/validators/senha-forte.decorator';

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

  @ApiPropertyOptional({ description: 'Nova senha de acesso', minLength: 8 })
  @IsOptional()
  @SenhaForte()
  senha?: string;
}
