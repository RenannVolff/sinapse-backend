import { BadRequestException } from '@nestjs/common';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsArray,
  IsBase64,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  validate,
} from 'class-validator';
import {
  exceptionFactoryValidacao,
  traduzirErrosValidacao,
} from './mensagens-validacao';

enum Cor {
  AZUL = 'AZUL',
  VERDE = 'VERDE',
}

class ItemDto {
  @IsString()
  @IsNotEmpty()
  titulo!: string;
}

class PadraoDto {
  @IsOptional() @IsString() texto?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsUUID() id?: string;
  @IsOptional() @IsInt() inteiro?: number;
  @IsOptional() @IsBoolean() ativo?: boolean;
  @IsOptional() @IsIn([1, 2]) nivel?: number;
  @IsOptional() @IsEnum(Cor) cor?: Cor;
  @IsOptional() @IsDateString() data?: string;
  @IsOptional() @Min(1) minimo?: number;
  @IsOptional() @Max(10) maximo?: number;
  @IsOptional() @MinLength(3) curto?: string;
  @IsOptional() @MaxLength(3) longo?: string;
  @IsOptional() @Matches(/^\d+$/) digitos?: string;
  @IsOptional() @IsArray() lista?: string[];
  @IsOptional() @IsBase64() imagem?: string;
  @IsOptional() @IsString({ each: true }) tags?: string[];
}

class ObrigatorioDto {
  @IsNotEmpty()
  @IsUUID()
  referenciaId!: string;

  @IsInt({ message: 'O mês deve ser um número inteiro de 1 a 12.' })
  @Min(1, { message: 'O mês deve ser um número inteiro de 1 a 12.' })
  @Max(12, { message: 'O mês deve ser um número inteiro de 1 a 12.' })
  mes!: number;
}

class PersonalizadoDto {
  @IsNotEmpty({ message: 'O título é obrigatório.' })
  @IsString({ message: 'O título deve ser um texto.' })
  titulo!: string;

  @IsEmail({}, { message: 'Forneça um e-mail válido' })
  email!: string;
}

class AninhadoDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemDto)
  itens!: ItemDto[];
}

async function mensagens(
  classe: new () => object,
  payload: object,
): Promise<string[]> {
  const erros = await validate(plainToInstance(classe, payload), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
  return traduzirErrosValidacao(erros);
}

const INGLES =
  /\b(must|should|property|each value|not exist|empty|valid|string|number)\b/i;

describe('exceptionFactoryValidacao', () => {
  it('traduz as mensagens padrão de cada restrição usada no projeto', async () => {
    const resultado = await mensagens(PadraoDto, {
      texto: 1,
      email: 'x',
      id: 'x',
      inteiro: 1.5,
      ativo: 'sim',
      nivel: 3,
      cor: 'ROXO',
      data: 'banana',
      minimo: 0,
      maximo: 11,
      curto: 'ab',
      longo: 'abcd',
      digitos: 'abc',
      lista: 'x',
      imagem: '***',
      tags: ['a', 2],
    });

    expect(resultado).toEqual([
      'O campo texto deve ser um texto.',
      'O campo email deve ser um e-mail válido.',
      'O campo id deve ser um identificador (UUID) válido.',
      'O campo inteiro deve ser um número inteiro.',
      'O campo ativo deve ser verdadeiro ou falso.',
      'O campo nivel deve ser um dos seguintes valores: 1, 2.',
      'O campo cor deve ser um dos seguintes valores: AZUL, VERDE.',
      'O campo data deve ser uma data válida (AAAA-MM-DD).',
      'O campo minimo não pode ser menor que 1.',
      'O campo maximo não pode ser maior que 10.',
      'O campo curto deve ter no mínimo 3 caracteres.',
      'O campo longo deve ter no máximo 3 caracteres.',
      'O campo digitos está em um formato inválido.',
      'O campo lista deve ser uma lista.',
      'O campo imagem deve estar codificado em base64.',
      'Cada item do campo tags deve ser um texto.',
    ]);
  });

  it('traduz o "campo que não deve existir" (whitelist)', async () => {
    expect(await mensagens(PadraoDto, { hack: 1 })).toEqual([
      'O campo hack não deve existir.',
    ]);
  });

  it('não altera mensagens já escritas em português nos DTOs', async () => {
    expect(
      await mensagens(PersonalizadoDto, { titulo: 5, email: 'x' }),
    ).toEqual(['O título deve ser um texto.', 'Forneça um e-mail válido']);
  });

  it('campo ausente sai só com "é obrigatório", sem as demais mensagens do campo', async () => {
    expect(await mensagens(ObrigatorioDto, { mes: 3 })).toEqual([
      'O campo referenciaId é obrigatório.',
    ]);
    expect(await mensagens(PersonalizadoDto, { email: 'a@b.com' })).toEqual([
      'O título é obrigatório.',
    ]);
  });

  it('remove mensagens repetidas', async () => {
    expect(
      await mensagens(ObrigatorioDto, {
        referenciaId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        mes: 'abc',
      }),
    ).toEqual(['O mês deve ser um número inteiro de 1 a 12.']);
  });

  it('usa o caminho completo em erros aninhados', async () => {
    expect(
      await mensagens(AninhadoDto, { itens: [{ titulo: 'ok' }, { x: 1 }] }),
    ).toEqual([
      'O campo itens.1.x não deve existir.',
      'O campo itens.1.titulo é obrigatório.',
    ]);
  });

  it('restrição fora do dicionário com mensagem padrão em inglês sai genérica em português', () => {
    expect(
      traduzirErrosValidacao([
        {
          property: 'site',
          constraints: { isUrl: 'site must be a URL address' },
          children: [],
        },
      ]),
    ).toEqual(['O campo site tem um valor inválido.']);
  });

  it('devolve um 400 no formato padrão do Nest, sem nenhuma mensagem em inglês', async () => {
    const erros = await validate(
      plainToInstance(PadraoDto, { texto: 1, email: 'x', hack: 1 }),
      { whitelist: true, forbidNonWhitelisted: true },
    );

    const excecao = exceptionFactoryValidacao(erros);

    expect(excecao).toBeInstanceOf(BadRequestException);
    expect(excecao.getStatus()).toBe(400);
    const resposta = excecao.getResponse() as { message: string[] };
    expect(resposta.message).toHaveLength(3);
    for (const m of resposta.message) expect(m).not.toMatch(INGLES);
  });
});
