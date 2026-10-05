import { IsDateString, IsOptional } from 'class-validator';

// Período opcional do gráfico de evolução; sem datas, usa o histórico todo.
export class EvolucaoQueryDto {
  @IsOptional()
  @IsDateString(
    {},
    { message: 'A data de início deve ser uma data válida (AAAA-MM-DD).' },
  )
  inicio?: string;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'A data de fim deve ser uma data válida (AAAA-MM-DD).' },
  )
  fim?: string;
}
