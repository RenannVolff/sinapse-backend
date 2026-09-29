import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class DesativarDoisFatoresDto {
  @ApiProperty({ description: 'Senha atual, para reconfirmar a identidade' })
  @IsString()
  @IsNotEmpty({ message: 'A senha é obrigatória' })
  senha!: string;
}
