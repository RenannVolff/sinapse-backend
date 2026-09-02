import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTarefaDto } from './dto/create-tarefa.dto';
import { UpdateTarefaDto } from './dto/update-tarefa.dto';

@Injectable()
export class TarefasService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateTarefaDto, usuarioId: string) {
    return this.prisma.tarefa.create({
      data: {
        texto: data.texto,
        notas: data.notas,
        usuarioId,
      },
    });
  }

  findAll(usuarioId: string) {
    return this.prisma.tarefa.findMany({
      where: { usuarioId, deletedAt: null },
      orderBy: { criadoEm: 'desc' },
    });
  }

  async findOne(id: string, usuarioId: string) {
    const tarefa = await this.prisma.tarefa.findFirst({
      where: { id, usuarioId, deletedAt: null },
    });
    if (!tarefa) throw new NotFoundException('Tarefa não encontrada.');
    return tarefa;
  }

  async update(id: string, data: UpdateTarefaDto, usuarioId: string) {
    await this.findOne(id, usuarioId);

    return this.prisma.tarefa.update({
      where: { id },
      data: {
        texto: data.texto,
        notas: data.notas,
        concluida: data.concluida,
      },
    });
  }

  async remove(id: string, usuarioId: string) {
    await this.findOne(id, usuarioId);

    return this.prisma.tarefa.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
