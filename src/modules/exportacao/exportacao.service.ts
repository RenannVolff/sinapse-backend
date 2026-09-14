import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { PrismaService } from '../../prisma/prisma.service';
import { ExportarDocxDto } from './dto/exportar-docx.dto';

const LARGURA_MAXIMA_IMAGEM_PX = 550;
const PNG_ASSINATURA = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

interface DocxGerado {
  buffer: Buffer;
  nomeArquivo: string;
}

@Injectable()
export class ExportacaoService {
  constructor(private readonly prisma: PrismaService) {}

  async gerarDocx(
    aprendenteId: string,
    dto: ExportarDocxDto,
    usuarioId: string,
  ): Promise<DocxGerado> {
    const aprendente = await this.prisma.aprendente.findFirst({
      where: { id: aprendenteId, usuarioId, deletedAt: null },
      select: { id: true },
    });
    if (!aprendente) {
      throw new NotFoundException('Aprendente não encontrado.');
    }

    const documento = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              heading: HeadingLevel.TITLE,
              text: `Relatório de Acompanhamento — ${dto.nomeAprendente}`,
            }),
            new Paragraph({
              text: `Gerado em: ${this.formatarDataHoje()}`,
              spacing: { after: 200 },
            }),
            ...this.montarParagrafosResumo(dto.resumoIa),
            ...this.montarSecoesGraficos(dto.graficos),
            this.montarParagrafoAviso(dto.avisoRevisao),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(documento);

    return {
      buffer,
      nomeArquivo: `relatorio-${this.slugificar(dto.nomeAprendente)}.docx`,
    };
  }

  private formatarDataHoje(): string {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  private montarParagrafosResumo(resumoIa: string): Paragraph[] {
    return resumoIa
      .split(/\n\s*\n/)
      .map((trecho) => trecho.trim())
      .filter((trecho) => trecho.length > 0)
      .map((trecho) => new Paragraph({ text: trecho, spacing: { after: 200 } }));
  }

  private montarSecoesGraficos(
    graficos: ExportarDocxDto['graficos'],
  ): Paragraph[] {
    return graficos.flatMap((grafico) => {
      const { width, height } = this.decodificarImagemPng(
        grafico.imagemBase64,
        grafico.titulo,
      );

      return [
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          text: grafico.titulo,
          spacing: { before: 200, after: 100 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new ImageRun({
              type: 'png',
              data: Buffer.from(grafico.imagemBase64, 'base64'),
              transformation: { width, height },
            }),
          ],
        }),
      ];
    });
  }

  private decodificarImagemPng(
    imagemBase64: string,
    titulo: string,
  ): { width: number; height: number } {
    const buffer = Buffer.from(imagemBase64, 'base64');

    if (
      buffer.length < 24 ||
      !buffer.subarray(0, 8).equals(PNG_ASSINATURA)
    ) {
      throw new BadRequestException(
        `Imagem inválida para o gráfico "${titulo}": esperado um PNG em base64.`,
      );
    }

    const larguraNatural = buffer.readUInt32BE(16);
    const alturaNatural = buffer.readUInt32BE(20);

    const largura = Math.min(larguraNatural, LARGURA_MAXIMA_IMAGEM_PX);
    const altura = Math.round((largura / larguraNatural) * alturaNatural);

    return { width: largura, height: altura };
  }

  private montarParagrafoAviso(avisoRevisao: string): Paragraph {
    return new Paragraph({
      spacing: { before: 400 },
      border: {
        top: { style: BorderStyle.SINGLE, size: 6, space: 8, color: '999999' },
      },
      children: [
        new TextRun({ text: avisoRevisao, italics: true }),
      ],
    });
  }

  private slugificar(texto: string): string {
    return texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}
