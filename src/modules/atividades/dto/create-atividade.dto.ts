import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsOptional,
} from 'class-validator';

export class CreateAtividadeDto {
  @IsUUID()
  @IsNotEmpty()
  atendimentoId: string;

  @IsString()
  @IsNotEmpty()
  titulo: string;

  @IsInt()
  @Min(1, { message: 'A dificuldade mínima é 1' })
  @Max(5, { message: 'A dificuldade máxima é 5' })
  nivelDificuldade: number;

  @IsString()
  @IsOptional()
  observacao?: string; // Agora garantimos: É UMA STRING, não um array.
}
