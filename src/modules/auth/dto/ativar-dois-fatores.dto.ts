import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, Matches } from 'class-validator';

export class AtivarDoisFatoresDto {
  @ApiProperty({
    description: 'Código de 6 dígitos exibido no app autenticador',
    example: '123456',
  })
  @IsNotEmpty({ message: 'O código é obrigatório' })
  @Matches(/^\d{6}$/, { message: 'O código deve ter 6 dígitos' })
  codigo!: string;
}
