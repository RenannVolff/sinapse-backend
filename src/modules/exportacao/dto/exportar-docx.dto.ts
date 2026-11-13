import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBase64,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  CampoDataDia,
  CampoTexto,
} from '../../../common/validation/campos.decorators';
import { LIMITES } from '../../../common/validation/limits.constants';

export const TIPOS_GRAFICO = ['line', 'bar', 'area'] as const;
export type TipoGrafico = (typeof TIPOS_GRAFICO)[number];

export const CHAVES_CHART_TYPES = [
  'acompanhamento',
  'media',
  'regressao',
] as const;
export type ChaveChartTypes = (typeof CHAVES_CHART_TYPES)[number];

export type ChartTypes = Partial<Record<ChaveChartTypes, TipoGrafico>>;

// Filtra em vez de validar: chave desconhecida ou valor fora do enum é
// descartado (sem 400) e o service cai no padrão daquele gráfico. Algo que
// não seja um objeto simples vira ausente.
export function normalizarChartTypes(valor: unknown): ChartTypes | undefined {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return undefined;
  }
  const entrada = valor as Record<string, unknown>;
  const resultado: ChartTypes = {};
  for (const chave of CHAVES_CHART_TYPES) {
    const tipo = Object.hasOwn(entrada, chave) ? entrada[chave] : undefined;
    if (
      typeof tipo === 'string' &&
      (TIPOS_GRAFICO as readonly string[]).includes(tipo)
    ) {
      resultado[chave] = tipo as TipoGrafico;
    }
  }
  return resultado;
}

// Só para documentação no Swagger; a "validação" é o @Transform acima.
export class ChartTypesDto {
  @ApiPropertyOptional({ enum: TIPOS_GRAFICO, example: 'line' })
  acompanhamento?: TipoGrafico;

  @ApiPropertyOptional({ enum: TIPOS_GRAFICO, example: 'bar' })
  media?: TipoGrafico;

  @ApiPropertyOptional({ enum: TIPOS_GRAFICO, example: 'line' })
  regressao?: TipoGrafico;
}

export class GraficoExportacaoDto {
  @ApiProperty({ description: 'Título do gráfico', maxLength: LIMITES.TITULO })
  @CampoTexto('Título do gráfico', LIMITES.TITULO)
  titulo!: string;

  @ApiProperty({
    description:
      'Imagem PNG do gráfico em base64, sem o prefixo data:image/png;base64,',
  })
  @IsBase64()
  @IsNotEmpty()
  @MaxLength(LIMITES.IMAGEM_BASE64_MAX, {
    message: 'Imagem do gráfico: arquivo grande demais.',
  })
  imagemBase64!: string;
}

export class ExportarDocxDto {
  @ApiProperty({
    description: 'Nome do aprendente para o cabeçalho do documento',
    maxLength: LIMITES.NOME_PESSOA,
  })
  @CampoTexto('Nome do aprendente', LIMITES.NOME_PESSOA)
  nomeAprendente!: string;

  @ApiProperty({
    description: 'Texto do relatório de IA/heurística já gerado',
    maxLength: LIMITES.TEXTO_RELATORIO,
  })
  @CampoTexto('Texto do relatório', LIMITES.TEXTO_RELATORIO)
  resumoIa!: string;

  @ApiProperty({
    type: [GraficoExportacaoDto],
    description: 'Gráficos capturados na tela do frontend',
  })
  @IsArray()
  @ArrayMaxSize(LIMITES.GRAFICOS_EXPORTACAO_MAX, {
    message: `Gráficos: no máximo ${LIMITES.GRAFICOS_EXPORTACAO_MAX} por documento.`,
  })
  @ValidateNested({ each: true })
  @Type(() => GraficoExportacaoDto)
  graficos!: GraficoExportacaoDto[];

  @ApiPropertyOptional({
    description:
      'Aviso de revisão profissional; se omitido ou vazio, usa AVISO_REVISAO_PADRAO',
    maxLength: LIMITES.TEXTO_CURTO,
  })
  @CampoTexto('Aviso de revisão', LIMITES.TEXTO_CURTO, {
    obrigatorio: false,
    permitirVazio: true,
  })
  avisoRevisao?: string;

  @ApiPropertyOptional({
    description:
      'Data de emissão (AAAA-MM-DD); não pode ser futura. Se omitida, usa hoje (horário de Brasília).',
    example: '2026-10-22',
  })
  @CampoDataDia('Data de emissão', {
    obrigatorio: false,
    naoFutura: true,
    minimo: LIMITES.DATA_MIN,
  })
  dataEmissao?: string;

  @ApiPropertyOptional({
    description:
      'Início do período analisado (AAAA-MM-DD). Se vier depois do fim, as datas são trocadas.',
    example: '2026-08-01',
  })
  @CampoDataDia('Início do período', {
    obrigatorio: false,
    minimo: LIMITES.DATA_MIN,
    maximo: LIMITES.DATA_MAX,
  })
  periodoInicio?: string;

  @ApiPropertyOptional({
    description: 'Fim do período analisado (AAAA-MM-DD)',
    example: '2026-10-22',
  })
  @CampoDataDia('Fim do período', {
    obrigatorio: false,
    minimo: LIMITES.DATA_MIN,
    maximo: LIMITES.DATA_MAX,
  })
  periodoFim?: string;

  @ApiPropertyOptional({
    type: ChartTypesDto,
    description:
      "Tipo de cada gráfico ('line' | 'bar' | 'area'). Opcional: chaves desconhecidas e valores inválidos são ignorados (sem erro 400) e o gráfico usa o padrão (acompanhamento=line, media=bar, regressao=line). Os tipos efetivos ficam registrados na descrição das propriedades do .docx.",
    example: { acompanhamento: 'line', media: 'bar', regressao: 'area' },
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => normalizarChartTypes(value))
  chartTypes?: ChartTypes;
}
