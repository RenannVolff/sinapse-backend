import { Injectable } from '@nestjs/common';
import { CreateAtividadeDto } from './dto/create-atividade.dto';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AtividadesService {
  constructor(private prisma: PrismaService) {}

  // Criação das atividades com as 5 tentativas padrão
  async create(dto: CreateAtividadeDto) {
    return this.prisma.atividade.create({
      data: {
        atendimentoId: dto.atendimentoId,
        titulo: dto.titulo,
        nivelDificuldade: dto.nivelDificuldade,
        observacao: dto.observacao || null,

        // Criação automática das 5 tentativas (Checklist)
        itensChecklist: {
          create: [
            { descricao: '1ª Tentativa' },
            { descricao: '2ª Tentativa' },
            { descricao: '3ª Tentativa' },
            { descricao: '4ª Tentativa' },
            { descricao: '5ª Tentativa' },
          ],
        },
      },
      include: { itensChecklist: true },
    });
  }

  // Marcar checkbox e Recalcular
  async toggleItem(itemId: string, realizado: boolean) {
    const itemAtualizado = await this.prisma.itemChecklist.update({
      where: { id: itemId },
      data: { realizado },
      include: { atividade: { include: { itensChecklist: true } } },
    });

    const atividade = itemAtualizado.atividade;
    const totalItens = 5;
    const acertos = atividade.itensChecklist.filter((i) => i.realizado).length;

    const novoPercentual = (acertos / totalItens) * 100;
    const novoScore = novoPercentual * atividade.nivelDificuldade;

    await this.prisma.atividade.update({
      where: { id: atividade.id },
      data: {
        percentualAcerto: novoPercentual,
        scorePonderado: novoScore,
      },
    });

    return { itemAtualizado, novoPercentual, novoScore };
  }

  // 3. Atualizar a Observação Geral
  async updateObservacao(atividadeId: string, texto: string) {
    return this.prisma.atividade.update({
      where: { id: atividadeId },
      data: { observacao: texto },
    });
  }
}
