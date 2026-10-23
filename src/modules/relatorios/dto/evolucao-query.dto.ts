import { CampoDataDia } from '../../../common/validation/campos.decorators';

// Período opcional do gráfico de evolução; sem datas, usa o histórico todo.
// Período invertido é trocado pelo controller (ver normalizarPeriodo).
export class EvolucaoQueryDto {
  @CampoDataDia('Data de início', { obrigatorio: false })
  inicio?: string;

  @CampoDataDia('Data de fim', { obrigatorio: false })
  fim?: string;
}
