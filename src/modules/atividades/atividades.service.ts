import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AtividadesService {
  constructor(private prisma: PrismaService) {}

  async create(
    data: {
      atendimentoId: string;
      titulo: string;
      nivelDificuldade: number;
    },
    usuarioId: string,
  ) {
    const atendimento = await this.prisma.atendimento.findFirst({
      where: {
        id: data.atendimentoId,
        aprendente: { usuarioId },
        deletedAt: null,
      },
    });
    if (!atendimento)
      throw new NotFoundException('Atendimento não encontrado.');

    return this.prisma.atividade.create({
      data: {
        atendimentoId: data.atendimentoId,
        titulo: data.titulo,
        nivelDificuldade: data.nivelDificuldade,
        itensChecklist: {
          create: [
            { descricao: '1ª Tentativa', realizado: false },
            { descricao: '2ª Tentativa', realizado: false },
            { descricao: '3ª Tentativa', realizado: false },
            { descricao: '4ª Tentativa', realizado: false },
            { descricao: '5ª Tentativa', realizado: false },
          ],
        },
      },
    });
  }

  // --- A FUNÇÃO QUE FALTAVA: Atualiza a caixa marcada ---
  async updateChecklist(id: string, realizado: boolean, usuarioId: string) {
    const item = await this.prisma.itemChecklist.findFirst({
      where: {
        id,
        atividade: {
          atendimento: { deletedAt: null, aprendente: { usuarioId } },
        },
      },
    });
    if (!item) throw new NotFoundException('Item de checklist não encontrado.');

    return this.prisma.itemChecklist.update({
      where: { id },
      data: { realizado },
    });
  }
}
