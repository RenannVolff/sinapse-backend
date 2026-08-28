import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePeiTemplateDto {
  @ApiProperty({ description: 'Nome do molde de PEI' })
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @ApiProperty({ description: 'Dificuldades padrão do molde' })
  @IsString()
  @IsNotEmpty()
  dificuldades!: string;

  @ApiProperty({ description: 'Objetivos padrão do molde' })
  @IsString()
  @IsNotEmpty()
  objetivos!: string;

  @ApiProperty({ description: 'Estratégias padrão do molde' })
  @IsString()
  @IsNotEmpty()
  estrategias!: string;
}
