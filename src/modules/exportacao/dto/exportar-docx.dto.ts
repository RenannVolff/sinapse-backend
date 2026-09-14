import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBase64,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class GraficoExportacaoDto {
  @ApiProperty({ description: 'Título do gráfico' })
  @IsString()
  @IsNotEmpty()
  titulo!: string;

  @ApiProperty({
    description:
      'Imagem PNG do gráfico em base64, sem o prefixo data:image/png;base64,',
  })
  @IsBase64()
  @IsNotEmpty()
  imagemBase64!: string;
}

export class ExportarDocxDto {
  @ApiProperty({ description: 'Nome do aprendente para o cabeçalho do documento' })
  @IsString()
  @IsNotEmpty()
  nomeAprendente!: string;

  @ApiProperty({ description: 'Texto do relatório de IA/heurística já gerado' })
  @IsString()
  @IsNotEmpty()
  resumoIa!: string;

  @ApiProperty({
    type: [GraficoExportacaoDto],
    description: 'Gráficos capturados na tela do frontend',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GraficoExportacaoDto)
  graficos!: GraficoExportacaoDto[];

  @ApiPropertyOptional({
    description:
      'Aviso de revisão profissional; se omitido ou vazio, usa AVISO_REVISAO_PADRAO',
  })
  @IsOptional()
  @IsString()
  avisoRevisao?: string;
}
