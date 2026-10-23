import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTarefaDto } from './dto/create-tarefa.dto';
import { UpdateTarefaDto } from './dto/update-tarefa.dto';
import { ListarTarefasQueryDto } from './dto/listar-tarefas-query.dto';

const POR_PAGINA_PADRAO = 20;

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

  // Ordem previsível: pendentes primeiro, depois as mais recentes; o id
  // desempata tarefas criadas no mesmo instante. Sem `pagina`/`porPagina`
  // devolve TODAS (nenhum corte implícito).
  async findAll(usuarioId: string, query: ListarTarefasQueryDto = {}) {
    const where = { usuarioId, deletedAt: null };
    const orderBy = [
      { concluida: 'asc' as const },
      { criadoEm: 'desc' as const },
      { id: 'asc' as const },
    ];

    const paginado =
      query.pagina !== undefined || query.porPagina !== undefined;
    const pagina = query.pagina ?? 1;
    const porPagina = query.porPagina ?? POR_PAGINA_PADRAO;

    const [itens, total] = await this.prisma.$transaction([
      this.prisma.tarefa.findMany({
        where,
        orderBy,
        ...(paginado
          ? { skip: (pagina - 1) * porPagina, take: porPagina }
          : {}),
      }),
      this.prisma.tarefa.count({ where }),
    ]);

    return {
      total,
      resultado: paginado ? { itens, total, pagina, porPagina } : itens,
    };
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
