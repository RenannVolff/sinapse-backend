import { registerDecorator, ValidationArguments } from 'class-validator';
import { extrairDia, formatarDiaBr, hojeNoFuso } from '../utils/datas';

export interface OpcoesDataDia {
  // Rejeita dia depois de hoje (fuso de Brasília)
  naoFutura?: boolean;
  // Rejeita dia anterior a hoje menos N anos
  anosAtrasMax?: number;
  // Faixa absoluta, em AAAA-MM-DD
  minimo?: string;
  maximo?: string;
}

function diaMinimoRelativo(anosAtras: number): string {
  const hoje = hojeNoFuso();
  return `${Number(hoje.slice(0, 4)) - anosAtras}${hoje.slice(4)}`;
}

// Devolve a mensagem da regra violada, ou null se a data é válida.
function violacao(
  rotulo: string,
  valor: unknown,
  opcoes: OpcoesDataDia,
): string | null {
  const dia = extrairDia(valor);
  if (!dia) return `${rotulo}: informe uma data válida (AAAA-MM-DD).`;
  if (opcoes.naoFutura && dia > hojeNoFuso())
    return `${rotulo}: não pode ser uma data futura.`;
  if (opcoes.anosAtrasMax && dia < diaMinimoRelativo(opcoes.anosAtrasMax))
    return `${rotulo}: não pode ser anterior a ${opcoes.anosAtrasMax} anos atrás.`;
  if (
    (opcoes.minimo && dia < opcoes.minimo) ||
    (opcoes.maximo && dia > opcoes.maximo)
  ) {
    const de = opcoes.minimo ? formatarDiaBr(opcoes.minimo) : undefined;
    const ate = opcoes.maximo ? formatarDiaBr(opcoes.maximo) : undefined;
    if (de && ate) return `${rotulo}: deve estar entre ${de} e ${ate}.`;
    return de
      ? `${rotulo}: não pode ser anterior a ${de}.`
      : `${rotulo}: não pode ser posterior a ${ate}.`;
  }
  return null;
}

// Valida uma data de calendário real e, opcionalmente, a faixa permitida.
// Uma única mensagem por falha, já no formato "Rótulo: regra".
export function DataDiaValida(rotulo: string, opcoes: OpcoesDataDia = {}) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'dataDiaValida',
      target: object.constructor,
      propertyName,
      validator: {
        validate(valor: unknown): boolean {
          return violacao(rotulo, valor, opcoes) === null;
        },
        defaultMessage(args: ValidationArguments): string {
          return (
            violacao(rotulo, args.value, opcoes) ??
            `${rotulo}: informe uma data válida (AAAA-MM-DD).`
          );
        },
      },
    });
  };
}
