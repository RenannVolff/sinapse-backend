import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePeiTemplateDto } from './dto/create-pei-template.dto';
import { UpdatePeiTemplateDto } from './dto/update-pei-template.dto';

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

  findAll(usuarioId: string) {
    return this.prisma.peiTemplate.findMany({
      where: { usuarioId, deletedAt: null },
      orderBy: { criadoEm: 'desc' },
    });
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

  async remove(id: string, usuarioId: string) {
    await this.findOne(id, usuarioId);

    return this.prisma.peiTemplate.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
