import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePeiDto } from './dto/create-pei.dto';
import { UpdatePeiDto } from './dto/update-pei.dto';

@Injectable()
export class PeiService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePeiDto, usuarioId: string) {
    const aprendente = await this.prisma.aprendente.findFirst({
      where: { id: data.aprendenteId, usuarioId, deletedAt: null },
    });
    if (!aprendente) throw new NotFoundException('Aprendente não encontrado.');

    if (data.templateOrigemId) {
      const template = await this.prisma.peiTemplate.findFirst({
        where: { id: data.templateOrigemId, usuarioId, deletedAt: null },
      });
      if (!template)
        throw new NotFoundException('Template de PEI não encontrado.');
    }

    return this.prisma.pEI.create({
      data: {
        aprendenteId: data.aprendenteId,
        dificuldades: data.dificuldades,
        objetivos: data.objetivos,
        estrategias: data.estrategias,
        dataInicio: new Date(data.dataInicio),
        dataFim: data.dataFim ? new Date(data.dataFim) : undefined,
        templateOrigemId: data.templateOrigemId,
      },
    });
  }

  findAll(usuarioId: string, aprendenteId?: string) {
    return this.prisma.pEI.findMany({
      where: {
        aprendente: { usuarioId },
        deletedAt: null,
        ...(aprendenteId ? { aprendenteId } : {}),
      },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async findOne(id: string, usuarioId: string) {
    const pei = await this.prisma.pEI.findFirst({
      where: { id, aprendente: { usuarioId }, deletedAt: null },
    });
    if (!pei) throw new NotFoundException('PEI não encontrado.');
    return pei;
  }

  async update(id: string, data: UpdatePeiDto, usuarioId: string) {
    await this.findOne(id, usuarioId);

    return this.prisma.pEI.update({
      where: { id },
      data: {
        dificuldades: data.dificuldades,
        objetivos: data.objetivos,
        estrategias: data.estrategias,
        dataInicio: data.dataInicio ? new Date(data.dataInicio) : undefined,
        dataFim: data.dataFim ? new Date(data.dataFim) : undefined,
      },
    });
  }

  async remove(id: string, usuarioId: string) {
    await this.findOne(id, usuarioId);

    return this.prisma.pEI.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
