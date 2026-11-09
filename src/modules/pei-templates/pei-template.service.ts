import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePeiTemplateDto } from './dto/create-pei-template.dto';
import { UpdatePeiTemplateDto } from './dto/update-pei-template.dto';
import { ListarPeiTemplatesQueryDto } from './dto/listar-pei-templates-query.dto';
import { PeiTemplate } from '@prisma/client';
import { sqlDirecao, textoOrdenavel } from '../../common/utils/ordenacao';

@Injectable()
export class PeiTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreatePeiTemplateDto, usuarioId: string) {
    return this.prisma.peiTemplate.create({
      data: {
        nome: data.nome,
        dificuldades: data.dificuldades,
        objetivos: data.objetivos,
        estrategias: data.estrategias,
        usuarioId,
      },
    });
  }

  // Ordem alfabética pelo título no banco, com collation ICU (ver
  // common/utils/ordenacao.ts); o id desempata títulos iguais. Só existe
  // `title` na whitelist do sortBy, então ele não muda o critério.
  findAll(usuarioId: string, query: ListarPeiTemplatesQueryDto = {}) {
    return this.prisma.$queryRaw<PeiTemplate[]>`
      SELECT * FROM "pei_templates"
      WHERE "usuarioId" = ${usuarioId} AND "deletedAt" IS NULL
      ORDER BY ${textoOrdenavel('nome')} ${sqlDirecao(query.order)}, "id" ASC`;
  }

  async findOne(id: string, usuarioId: string) {
    const template = await this.prisma.peiTemplate.findFirst({
      where: { id, usuarioId, deletedAt: null },
    });
    if (!template)
      throw new NotFoundException('Template de PEI não encontrado.');
    return template;
  }

  async update(id: string, data: UpdatePeiTemplateDto, usuarioId: string) {
    await this.findOne(id, usuarioId);

    return this.prisma.peiTemplate.update({
      where: { id },
      data: {
        nome: data.nome,
        dificuldades: data.dificuldades,
        objetivos: data.objetivos,
        estrategias: data.estrategias,
      },
    });
  }

  // Soft delete numa única instrução condicionada a deletedAt null: uma
  // segunda exclusão (mesmo concorrente) não sobrescreve a data original e
  // responde 404, igual a id inexistente ou de outro terapeuta. PEIs criados
  // a partir do molde não são tocados (templateOrigemId continua apontando
  // para a linha, que nunca é removida).
  async remove(id: string, usuarioId: string) {
    const { count } = await this.prisma.peiTemplate.updateMany({
      where: { id, usuarioId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (count === 0)
      throw new NotFoundException('Template de PEI não encontrado.');
  }
}
