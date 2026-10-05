import { IsDateString } from 'class-validator';

// Período do relatório inteligente; o frontend sempre envia as duas datas.
export class RelatorioIaQueryDto {
  @IsDateString(
    {},
    { message: 'A data de início deve ser uma data válida (AAAA-MM-DD).' },
  )
  inicio!: string;

  @IsDateString(
    {},
    { message: 'A data de fim deve ser uma data válida (AAAA-MM-DD).' },
  )
  fim!: string;
}
