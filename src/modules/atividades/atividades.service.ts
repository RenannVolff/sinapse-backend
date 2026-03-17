import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AtividadesService {
  constructor(private prisma: PrismaService) {}

  create(data: {
    atendimentoId: string;
    titulo: string;
    nivelDificuldade: number;
  }) {
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
  updateChecklist(id: string, realizado: boolean) {
    return this.prisma.itemChecklist.update({
      where: { id },
      data: { realizado },
    });
  }
}
