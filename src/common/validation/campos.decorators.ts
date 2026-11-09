import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateBy,
  isEmail,
} from 'class-validator';
import { LIMITES } from './limits.constants';
import { sanitizarNome, sanitizarTexto } from './sanitizar';
import { DataDiaValida, OpcoesDataDia } from '../validators/data-dia.validator';
import { EmailReal } from '../validators/email-real.validator';

// Decorators de campo compartilhados pelos DTOs. Cada um junta tipo,
// obrigatoriedade, limite (de LIMITES) e sanitização, com mensagens no
// formato "Rótulo: regra" que o front exibe ao lado do campo.

interface OpcoesCampo {
  // false = campo opcional (pode ser omitido ou null). Quando enviado,
  // continua não podendo ser vazio, a menos que `permitirVazio`.
  obrigatorio?: boolean;
  permitirVazio?: boolean;
}

function presenca(rotulo: string, opcoes: OpcoesCampo): PropertyDecorator[] {
  const obrigatorio = opcoes.obrigatorio ?? true;
  const decorators: PropertyDecorator[] = [];
  if (!obrigatorio) decorators.push(IsOptional());
  if (!opcoes.permitirVazio) {
    decorators.push(IsNotEmpty({ message: `${rotulo}: campo obrigatório.` }));
  }
  return decorators;
}

// Regra que só se aplica a texto: com valor de outro tipo, quem reclama é o
// IsString, e o campo não ganha uma segunda mensagem enganosa ("máximo de N
// caracteres" para um número).
function regraDeTexto(
  nome: string,
  regra: (texto: string) => boolean,
  mensagem: string,
): PropertyDecorator {
  return ValidateBy({
    name: nome,
    validator: {
      validate: (valor: unknown) => typeof valor !== 'string' || regra(valor),
      defaultMessage: () => mensagem,
    },
  });
}

function tamanhoMaximo(rotulo: string, maximo: number): PropertyDecorator {
  return regraDeTexto(
    'maxLength',
    (texto) => texto.length <= maximo,
    `${rotulo}: máximo de ${maximo} caracteres.`,
  );
}

// Texto livre (título, descrição, observação...). Apara, remove HTML e
// limita o tamanho.
export function CampoTexto(
  rotulo: string,
  maximo: number,
  opcoes: OpcoesCampo = {},
) {
  return applyDecorators(
    Transform(({ value }) => sanitizarTexto(value)),
    ...presenca(rotulo, opcoes),
    IsString({ message: `${rotulo}: deve ser um texto.` }),
    tamanhoMaximo(rotulo, maximo),
  );
}

// Letras (com acento), espaço, ponto, hífen e apóstrofo; começa em letra e
// termina em letra ou ponto ("Dr. João", "João Silva Jr."). O front espelha.
export const REGEX_NOME_PESSOA = /^\p{L}+(?:[\p{L} .'’-]*[\p{L}.])?$/u;

export function CampoNomePessoa(rotulo: string, opcoes: OpcoesCampo = {}) {
  return applyDecorators(
    Transform(({ value }) => sanitizarNome(value)),
    ...presenca(rotulo, opcoes),
    IsString({ message: `${rotulo}: deve ser um texto.` }),
    tamanhoMaximo(rotulo, LIMITES.NOME_PESSOA),
    regraDeTexto(
      'nomePessoa',
      // Vazio fica a cargo do IsNotEmpty (ou é permitido)
      (texto) => texto === '' || REGEX_NOME_PESSOA.test(texto),
      `${rotulo}: use apenas letras, espaço, ponto, hífen ou apóstrofo.`,
    ),
  );
}

// Telefone/contato: dígitos, espaço, parênteses, hífen e "+".
export function CampoTelefone(rotulo: string, opcoes: OpcoesCampo = {}) {
  return applyDecorators(
    Transform(({ value }) => sanitizarNome(value)),
    ...presenca(rotulo, opcoes),
    IsString({ message: `${rotulo}: deve ser um texto.` }),
    tamanhoMaximo(rotulo, LIMITES.TELEFONE),
    regraDeTexto(
      'telefone',
      (texto) => texto === '' || /^\+?[\d\s()-]{8,}$/.test(texto),
      `${rotulo}: informe um telefone válido, ex.: (47) 99999-0000.`,
    ),
  );
}

// E-mail: apara e põe em minúsculas antes de validar. `verificarDominio`
// liga a checagem de domínio descartável/inexistente e a sugestão de erro de
// digitação (só no cadastro/troca de e-mail, nunca no login).
export function CampoEmail(
  rotulo: string,
  opcoes: OpcoesCampo & { maximo?: number; verificarDominio?: boolean } = {},
) {
  const maximo = opcoes.maximo ?? LIMITES.EMAIL;
  const decorators: PropertyDecorator[] = [
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim().toLowerCase() : value,
    ),
    ...presenca(rotulo, opcoes),
    IsString({ message: `${rotulo}: deve ser um texto.` }),
    tamanhoMaximo(rotulo, maximo),
    regraDeTexto(
      'isEmail',
      (texto) => texto === '' || isEmail(texto),
      `${rotulo}: informe um e-mail válido.`,
    ),
  ];
  if (opcoes.verificarDominio) decorators.push(EmailReal());
  return applyDecorators(...decorators);
}

// Inteiro com faixa explícita. `daQuery` converte a string da query antes.
export function CampoInteiro(
  rotulo: string,
  minimo: number,
  maximo: number,
  opcoes: OpcoesCampo & { daQuery?: boolean } = {},
) {
  const decorators: PropertyDecorator[] = [];
  if (opcoes.daQuery) {
    decorators.push(
      Transform(({ value }: { value: unknown }) =>
        typeof value === 'string' && value.trim() !== ''
          ? Number(value)
          : value,
      ),
    );
  }
  // Mesma mensagem nas três regras: o filtro de repetidas deixa uma só
  const mensagemFaixa = `${rotulo}: deve ser um número inteiro de ${minimo} a ${maximo}.`;
  decorators.push(
    ...presenca(rotulo, { ...opcoes, permitirVazio: true }),
    IsInt({ message: mensagemFaixa }),
    Min(minimo, { message: mensagemFaixa }),
    Max(maximo, { message: mensagemFaixa }),
  );
  return applyDecorators(...decorators);
}

// Valor fechado (whitelist), ex.: campo de ordenação vindo da query. Qualquer
// valor fora da lista responde 400.
export function CampoOpcao(
  rotulo: string,
  valores: readonly string[],
  opcoes: OpcoesCampo = {},
) {
  return applyDecorators(
    ...presenca(rotulo, opcoes),
    IsIn(valores, {
      message: `${rotulo}: use um dos valores: ${valores.join(', ')}.`,
    }),
  );
}

// Data "só dia" (AAAA-MM-DD; também aceita ISO completo e usa o dia escrito),
// com as faixas de OpcoesDataDia.
export function CampoDataDia(
  rotulo: string,
  opcoes: OpcoesCampo & OpcoesDataDia = {},
) {
  return applyDecorators(
    Transform(({ value }: { value: unknown }) =>
      typeof value === 'string' ? value.trim() : value,
    ),
    ...presenca(rotulo, opcoes),
    DataDiaValida(rotulo, opcoes),
  );
}
