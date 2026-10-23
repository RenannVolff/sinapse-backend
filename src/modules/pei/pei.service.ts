import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePeiDto } from './dto/create-pei.dto';
import { UpdatePeiDto } from './dto/update-pei.dto';
import { diaParaArmazenar, extrairDia } from '../../common/utils/datas';
import { excecaoValidacao } from '../../common/validation/mensagens-validacao';

// Data só-dia já validada pelo DTO; gravada ao meio-dia UTC (ver datas.ts)
function dataDia(valor: string): Date {
  return diaParaArmazenar(extrairDia(valor) ?? valor);
}

@Injectable()
export class PeiService {
  constructor(private readonly prisma: PrismaService) {}

  // Fim antes do início é incoerente num plano (diferente de um filtro de
  // relatório, aqui não se troca sozinho: o profissional corrige).
  private validarVigencia(dataInicio: Date, dataFim: Date | null): void {
    if (dataFim && dataFim.getTime() < dataInicio.getTime()) {
      throw excecaoValidacao([
        {
          field: 'dataFim',
          message: 'Data de fim: deve ser igual ou posterior à data de início.',
        },
      ]);
    }
  }

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

    const dataInicio = dataDia(data.dataInicio);
    const dataFim = data.dataFim ? dataDia(data.dataFim) : null;
    this.validarVigencia(dataInicio, dataFim);

    return this.prisma.pEI.create({
      data: {
        aprendenteId: data.aprendenteId,
        dificuldades: data.dificuldades,
        objetivos: data.objetivos,
        estrategias: data.estrategias,
        dataInicio,
        dataFim,
        templateOrigemId: data.templateOrigemId,
      },
    });
  }

  findAll(usuarioId: string, aprendenteId?: string) {
    return this.prisma.pEI.findMany({
      where: {
        aprendente: { usuarioId, deletedAt: null },
        deletedAt: null,
        ...(aprendenteId ? { aprendenteId } : {}),
      },
      orderBy: [{ criadoEm: 'desc' }, { id: 'asc' }],
    });
  }

  async findOne(id: string, usuarioId: string) {
    const pei = await this.prisma.pEI.findFirst({
      where: {
        id,
        aprendente: { usuarioId, deletedAt: null },
        deletedAt: null,
      },
    });
    if (!pei) throw new NotFoundException('PEI não encontrado.');
    return pei;
  }

  async update(id: string, data: UpdatePeiDto, usuarioId: string) {
    const atual = await this.findOne(id, usuarioId);

    // Campo omitido mantém o gravado; `dataFim: null` remove o fim do plano.
    const dataInicio = data.dataInicio
      ? dataDia(data.dataInicio)
      : atual.dataInicio;
    const dataFim =
      data.dataFim === undefined
        ? atual.dataFim
        : data.dataFim === null
          ? null
          : dataDia(data.dataFim);
    this.validarVigencia(dataInicio, dataFim);

    return this.prisma.pEI.update({
      where: { id },
      data: {
        dificuldades: data.dificuldades,
        objetivos: data.objetivos,
        estrategias: data.estrategias,
        dataInicio,
        dataFim,
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
