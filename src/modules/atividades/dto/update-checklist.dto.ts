import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateChecklistDto {
  @ApiProperty({ description: 'Se a tentativa foi realizada com sucesso' })
  @IsBoolean({ message: 'O campo realizado deve ser verdadeiro ou falso.' })
  realizado!: boolean;
}
