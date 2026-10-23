import { CampoDataDia } from '../../../common/validation/campos.decorators';

// Período do relatório inteligente; o frontend sempre envia as duas datas.
// Período invertido não é erro: o service troca as datas (ver normalizarPeriodo).
export class RelatorioIaQueryDto {
  @CampoDataDia('Data de início')
  inicio!: string;

  @CampoDataDia('Data de fim')
  fim!: string;
}
