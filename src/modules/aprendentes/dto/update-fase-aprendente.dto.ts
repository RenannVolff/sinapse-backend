import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { FaseAtendimento } from '@prisma/client';

// DTO para atualizar explicitamente a fase (linha de base/intervenção) de um aprendente
export class UpdateFaseAprendenteDto {
  @ApiProperty({ enum: FaseAtendimento, description: 'Nova fase do aprendente' })
  @IsEnum(FaseAtendimento)
  @IsNotEmpty()
  fase!: FaseAtendimento;
}
