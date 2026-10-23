// Datas "só dia" (AAAA-MM-DD, vindas de <input type="date">) e períodos.
//
// O servidor roda em UTC (Render), mas o usuário está no Brasil. Sem cuidado,
// `new Date('2026-10-01')` vira meia-noite UTC = 30/09 às 21h no Brasil, e a
// data aparece/filtra como o dia anterior. Regras usadas aqui:
// - Para GUARDAR uma data só-dia (nascimento, vigência do PEI), grava ao
//   meio-dia UTC: em qualquer fuso de -11h a +11h continua sendo o mesmo dia.
// - Para FILTRAR por período, o dia é interpretado no fuso de Brasília (sem
//   horário de verão desde 2019, então o deslocamento fixo -03:00 é exato).

export const FUSO_PADRAO = 'America/Sao_Paulo';
const DESLOCAMENTO_FUSO = '-03:00';

const REGEX_DIA = /^(\d{4})-(\d{2})-(\d{2})/;

// Extrai o dia (AAAA-MM-DD) do início da string, como foi escrito pelo
// cliente — sem converter fuso. Devolve null se não for uma data de
// calendário real (ex: 2026-02-30).
export function extrairDia(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  const casou = REGEX_DIA.exec(valor.trim());
  if (!casou) return null;

  const [, ano, mes, dia] = casou.map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const valida =
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia;
  return valida ? casou[0] : null;
}

export function diaParaArmazenar(dia: string): Date {
  return new Date(`${dia}T12:00:00.000Z`);
}

export function inicioDoDia(dia: string): Date {
  return new Date(`${dia}T00:00:00.000${DESLOCAMENTO_FUSO}`);
}

export function fimDoDia(dia: string): Date {
  return new Date(`${dia}T23:59:59.999${DESLOCAMENTO_FUSO}`);
}

// "Hoje" no fuso de Brasília, como AAAA-MM-DD (en-CA formata nessa ordem).
export function hojeNoFuso(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_PADRAO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

export function formatarDiaBr(dia: string): string {
  const [ano, mes, d] = dia.split('-');
  return `${d}/${mes}/${ano}`;
}

export interface PeriodoNormalizado {
  inicio?: string;
  fim?: string;
  // true quando o cliente mandou início depois do fim e as datas foram trocadas
  invertido: boolean;
  desde?: Date;
  ate?: Date;
}

// Normaliza um período de filtro: interpreta cada ponta como dia inteiro no
// fuso de Brasília e, se vier invertido, troca as duas em vez de devolver
// um resultado vazio. As datas já chegam validadas pelo DTO.
export function normalizarPeriodo(
  inicioBruto?: string,
  fimBruto?: string,
): PeriodoNormalizado {
  let inicio = inicioBruto ? (extrairDia(inicioBruto) ?? undefined) : undefined;
  let fim = fimBruto ? (extrairDia(fimBruto) ?? undefined) : undefined;

  // Comparação de AAAA-MM-DD como texto equivale à comparação de datas
  const invertido = !!inicio && !!fim && inicio > fim;
  if (invertido) [inicio, fim] = [fim, inicio];

  return {
    inicio,
    fim,
    invertido,
    desde: inicio ? inicioDoDia(inicio) : undefined,
    ate: fim ? fimDoDia(fim) : undefined,
  };
}
