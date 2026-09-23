import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class EsqueciSenhaDto {
  @ApiProperty({ description: 'E-mail cadastrado' })
  @IsEmail({}, { message: 'Forneça um e-mail válido' })
  @IsNotEmpty()
  email!: string;
}
