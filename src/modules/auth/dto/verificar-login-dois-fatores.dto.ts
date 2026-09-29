import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class VerificarLoginDoisFatoresDto {
  @ApiProperty({ description: 'Token temporário devolvido pelo /auth/login' })
  @IsString()
  @IsNotEmpty({ message: 'O token temporário é obrigatório' })
  tokenTemporario!: string;

  @ApiProperty({
    description: 'Código de 6 dígitos do app autenticador ou código de backup',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty({ message: 'O código é obrigatório' })
  @MaxLength(20)
  codigo!: string;
}
