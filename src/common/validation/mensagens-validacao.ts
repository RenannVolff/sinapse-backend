import { BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

// Tradução das mensagens PADRÃO do class-validator. Cada entrada traz o
// modelo em inglês da lib ($property / $constraint1) e a versão em
// português. Só traduz quando a mensagem é igual ao modelo em inglês, então
// mensagens personalizadas nos DTOs passam intactas.
interface Traducao {
  modelo: string;
  traduzir: (sujeito: string, restricao: string) => string;
}

const TRADUCOES: Record<string, Traducao> = {
  isNotEmpty: {
    modelo: '$property should not be empty',
    traduzir: (s) => `${s} é obrigatório.`,
  },
  isDefined: {
    modelo: '$property should not be null or undefined',
    traduzir: (s) => `${s} é obrigatório.`,
  },
  isString: {
    modelo: '$property must be a string',
    traduzir: (s) => `${s} deve ser um texto.`,
  },
  isEmail: {
    modelo: '$property must be an email',
    traduzir: (s) => `${s} deve ser um e-mail válido.`,
  },
  isUuid: {
    modelo: '$property must be a UUID',
    traduzir: (s) => `${s} deve ser um identificador (UUID) válido.`,
  },
  isInt: {
    modelo: '$property must be an integer number',
    traduzir: (s) => `${s} deve ser um número inteiro.`,
  },
  isNumber: {
    modelo:
      '$property must be a number conforming to the specified constraints',
    traduzir: (s) => `${s} deve ser um número.`,
  },
  isBoolean: {
    modelo: '$property must be a boolean value',
    traduzir: (s) => `${s} deve ser verdadeiro ou falso.`,
  },
  isIn: {
    modelo: '$property must be one of the following values: $constraint1',
    traduzir: (s, r) => `${s} deve ser um dos seguintes valores: ${r}.`,
  },
  isEnum: {
    modelo: '$property must be one of the following values: $constraint1',
    traduzir: (s, r) => `${s} deve ser um dos seguintes valores: ${r}.`,
  },
  isDateString: {
    modelo: '$property must be a valid ISO 8601 date string',
    traduzir: (s) => `${s} deve ser uma data válida (AAAA-MM-DD).`,
  },
  isIso8601: {
    modelo: '$property must be a valid ISO 8601 date string',
    traduzir: (s) => `${s} deve ser uma data válida (AAAA-MM-DD).`,
  },
  isDate: {
    modelo: '$property must be a Date instance',
    traduzir: (s) => `${s} deve ser uma data válida.`,
  },
  min: {
    modelo: '$property must not be less than $constraint1',
    traduzir: (s, r) => `${s} não pode ser menor que ${r}.`,
  },
  max: {
    modelo: '$property must not be greater than $constraint1',
    traduzir: (s, r) => `${s} não pode ser maior que ${r}.`,
  },
  minLength: {
    modelo: '$property must be longer than or equal to $constraint1 characters',
    traduzir: (s, r) => `${s} deve ter no mínimo ${r} caracteres.`,
  },
  maxLength: {
    modelo:
      '$property must be shorter than or equal to $constraint1 characters',
    traduzir: (s, r) => `${s} deve ter no máximo ${r} caracteres.`,
  },
  matches: {
    modelo: '$property must match $constraint1 regular expression',
    traduzir: (s) => `${s} está em um formato inválido.`,
  },
  isArray: {
    modelo: '$property must be an array',
    traduzir: (s) => `${s} deve ser uma lista.`,
  },
  arrayNotEmpty: {
    modelo: '$property should not be empty',
    traduzir: (s) => `${s} não pode ser uma lista vazia.`,
  },
  arrayMinSize: {
    modelo: '$property must contain at least $constraint1 elements',
    traduzir: (s, r) => `${s} deve ter pelo menos ${r} itens.`,
  },
  arrayMaxSize: {
    modelo: '$property must contain no more than $constraint1 elements',
    traduzir: (s, r) => `${s} deve ter no máximo ${r} itens.`,
  },
  isObject: {
    modelo: '$property must be an object',
    traduzir: (s) => `${s} deve ser um objeto.`,
  },
  isBase64: {
    modelo: '$property must be base64 encoded',
    traduzir: (s) => `${s} deve estar codificado em base64.`,
  },
  nestedValidation: {
    modelo: 'nested property $property must be either object or array',
    traduzir: (s) => `${s} deve ser um objeto ou uma lista.`,
  },
  whitelistValidation: {
    modelo: 'property $property should not exist',
    traduzir: (s) => `${s} não deve existir.`,
  },
};

// Restrições que indicam campo ausente: quando uma delas falha, as demais
// mensagens do mesmo campo ("deve ser um UUID", "deve ser um texto"...) só
// repetem o problema e são descartadas.
const RESTRICOES_DE_PRESENCA = ['isNotEmpty', 'isDefined'];

const PREFIXO_CADA = 'each value in ';

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function traduzirMensagem(
  restricao: string,
  mensagem: string,
  propriedade: string,
  caminho: string,
): string {
  const traducao = TRADUCOES[restricao];
  if (traducao) {
    const padrao = escaparRegex(traducao.modelo)
      .replace('\\$property', escaparRegex(propriedade))
      .replace('\\$constraint1', '(.+)');
    const casou = new RegExp(
      `^(${escaparRegex(PREFIXO_CADA)})?${padrao}$`,
    ).exec(mensagem);
    if (casou) {
      const sujeito = casou[1]
        ? `Cada item do campo ${caminho}`
        : `O campo ${caminho}`;
      return traducao.traduzir(sujeito, casou[2] ?? '');
    }
  }

  // Restrição sem entrada no dicionário, mas com a mensagem no formato
  // padrão da lib (começa pelo nome da propriedade): nunca sai em inglês.
  if (
    mensagem.startsWith(`${propriedade} `) ||
    mensagem.startsWith(`${PREFIXO_CADA}${propriedade} `)
  ) {
    return `O campo ${caminho} tem um valor inválido.`;
  }

  return mensagem;
}

export interface ErroCampo {
  field: string;
  message: string;
}

export const CODIGO_ERRO_VALIDACAO = 'VALIDATION_ERROR';
export const MENSAGEM_ERRO_VALIDACAO = 'Revise os campos destacados.';

function coletarErros(
  erros: ValidationError[],
  caminhoPai: string,
  saida: ErroCampo[],
): void {
  for (const erro of erros) {
    const caminho = caminhoPai
      ? `${caminhoPai}.${erro.property}`
      : erro.property;
    const restricoes = Object.entries(erro.constraints ?? {});
    const presenca = restricoes.filter(([nome]) =>
      RESTRICOES_DE_PRESENCA.includes(nome),
    );

    for (const [nome, mensagem] of presenca.length ? presenca : restricoes) {
      saida.push({
        field: caminho,
        message: traduzirMensagem(nome, mensagem, erro.property, caminho),
      });
    }

    if (erro.children?.length) {
      coletarErros(erro.children, caminho, saida);
    }
  }
}

// Um item por campo/violação, sem repetir a mesma mensagem no mesmo campo.
// `field` é o caminho do campo como o front enviou (ex: graficos.0.titulo).
export function traduzirErrosPorCampo(erros: ValidationError[]): ErroCampo[] {
  const saida: ErroCampo[] = [];
  coletarErros(erros, '', saida);
  const vistos = new Set<string>();
  return saida.filter(({ field, message }) => {
    const chave = `${field}|${message}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

export function traduzirErrosValidacao(erros: ValidationError[]): string[] {
  return [
    ...new Set(traduzirErrosPorCampo(erros).map(({ message }) => message)),
  ];
}

// 400 no formato do contrato com o front:
// { statusCode, code: 'VALIDATION_ERROR', message, errors: [{ field, message }] }
// Usado pelo ValidationPipe e pelos services, para regras que dependem do
// banco (ex: data de fim do PEI anterior à data de início já gravada).
export function excecaoValidacao(erros: ErroCampo[]): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    code: CODIGO_ERRO_VALIDACAO,
    message: MENSAGEM_ERRO_VALIDACAO,
    errors: erros,
  });
}

export function exceptionFactoryValidacao(
  erros: ValidationError[],
): BadRequestException {
  return excecaoValidacao(traduzirErrosPorCampo(erros));
}
