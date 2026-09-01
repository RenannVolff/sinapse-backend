import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, StatusAtendimento, FaseAtendimento } from '@prisma/client';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  IsDateString,
  Min,
} from 'class-validator'; // Importações de Segurança
import { IsDateNotInPast } from '../../common/validators/is-date-not-in-past.validator';

// DTOs blindados para o NestJS aceitar os dados
export class CreateAtendimentoDto {
  @IsNotEmpty({ message: 'O identificador do aprendente é obrigatório.' })
  @IsString()
  aprendenteId!: string;

  @IsNotEmpty({ message: 'A data do atendimento é obrigatória.' })
  @IsDateString({}, { message: 'Data inválida' })
  @IsDateNotInPast()
  dataAtendimento!: string | Date;

  // Duração da sessão em minutos, usada na checagem de conflito de horário.
  @IsOptional()
  @IsInt()
  @Min(1)
  duracaoMinutos?: number;

  @IsNotEmpty({ message: 'O título da sessão é obrigatório.' })
  @IsString()
  tituloSessao!: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  // Sobrescrita pontual da fase; se omitido, usa aprendente.faseAtual no momento da criação.
  @IsOptional()
  @IsEnum(FaseAtendimento)
  fase?: FaseAtendimento;
}

export class UpdateAtendimentoDto {
  @IsOptional()
  dataAtendimento?: string | Date;

  @IsOptional()
  @IsInt()
  @Min(1)
  duracaoMinutos?: number;

  @IsOptional()
  @IsString()
  tituloSessao?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsEnum(StatusAtendimento)
  status?: StatusAtendimento;

  @IsOptional()
  @IsBoolean()
  concluido?: boolean;
}

// DTO dedicado para a troca explícita de status (confirmar/cancelar manualmente).
export class UpdateStatusAtendimentoDto {
  @IsNotEmpty({ message: 'O status é obrigatório.' })
  @IsEnum(StatusAtendimento)
  status!: StatusAtendimento;
}

@Injectable()
export class AtendimentosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAtendimentoDto, usuarioId: string) {
    const aprendente = await this.prisma.aprendente.findFirst({
      where: { id: data.aprendenteId, usuarioId, deletedAt: null },
    });
    if (!aprendente) throw new NotFoundException('Aprendente não encontrado.');

    const duracaoMinutos = data.duracaoMinutos ?? 60;
    const inicio = new Date(data.dataAtendimento);
    const fim = new Date(inicio.getTime() + duracaoMinutos * 60000);

    await this.verificarConflitoHorario(usuarioId, inicio, fim);

    try {
      return await this.prisma.atendimento.create({
        data: {
          aprendenteId: data.aprendenteId,
          dataAtendimento: inicio,
          duracaoMinutos,
          tituloSessao: data.tituloSessao,
          observacoes: data.observacoes,
          status: StatusAtendimento.AGUARDANDO_CONFIRMACAO,
          concluido: false,
          fase: data.fase ?? aprendente.faseAtual,
        },
      });
    } catch (error) {
      console.error('Erro no Prisma ao criar agendamento:', error);
      throw new InternalServerErrorException(
        'Erro ao criar agendamento no banco de dados.',
      );
    }
  }

  // Impede dois atendimentos sobrepostos para o mesmo terapeuta (usuarioId),
  // independente do aprendente — ele não pode estar em dois lugares ao mesmo
  // tempo. Atendimentos CANCELADO contam como horário livre/realocável.
  private async verificarConflitoHorario(
    usuarioId: string,
    inicio: Date,
    fim: Date,
  ) {
    // Margem de busca para trás: cobre sessões já existentes que começaram
    // antes de `inicio` mas cuja duração ainda avança para dentro do novo
    // intervalo. 24h é uma folga generosa acima de qualquer duração real de
    // sessão.
    const margemBusca = new Date(inicio.getTime() - 24 * 60 * 60 * 1000);

    const candidatos = await this.prisma.atendimento.findMany({
      where: {
        aprendente: { usuarioId },
        deletedAt: null,
        status: { not: StatusAtendimento.CANCELADO },
        dataAtendimento: { gte: margemBusca, lt: fim },
      },
      select: { dataAtendimento: true, duracaoMinutos: true },
    });

    const temConflito = candidatos.some((atendimento) => {
      const fimExistente = new Date(
        atendimento.dataAtendimento.getTime() +
          atendimento.duracaoMinutos * 60000,
      );
      return fimExistente > inicio;
    });

    if (temConflito) {
      throw new BadRequestException(
        'Já existe um atendimento agendado nesse horário.',
      );
    }
  }

  async findAllCalendario(mes: number, ano: number, usuarioId: string) {
    const dataInicio = new Date(ano, mes - 1, 1);
    const dataFim = new Date(ano, mes, 0, 23, 59, 59);

    return this.prisma.atendimento.findMany({
      where: {
        aprendente: { usuarioId },
        deletedAt: null,
        dataAtendimento: {
          gte: dataInicio,
          lte: dataFim,
        },
      },
      include: {
        aprendente: { select: { nomeCompleto: true } },
      },
      orderBy: { dataAtendimento: 'asc' },
    });
  }

  async findOne(id: string, usuarioId: string) {
    const atendimento = await this.prisma.atendimento.findFirst({
      where: { id, aprendente: { usuarioId }, deletedAt: null },
      include: {
        aprendente: { select: { nomeCompleto: true } },
        atividades: {
          orderBy: { id: 'asc' },
          include: {
            itensChecklist: { orderBy: { id: 'asc' } },
          },
        },
      },
    });

    if (!atendimento) throw new NotFoundException('Sessão não encontrada.');
    return atendimento;
  }

  async update(id: string, data: UpdateAtendimentoDto, usuarioId: string) {
    await this.findOne(id, usuarioId);

    const dadosAtualizados: Prisma.AtendimentoUpdateInput = {};

    if (data.tituloSessao) dadosAtualizados.tituloSessao = data.tituloSessao;
    if (data.observacoes !== undefined)
      dadosAtualizados.observacoes = data.observacoes;
    if (data.status) dadosAtualizados.status = data.status;
    if (data.concluido !== undefined)
      dadosAtualizados.concluido = data.concluido;
    if (data.dataAtendimento)
      dadosAtualizados.dataAtendimento = new Date(data.dataAtendimento);
    if (data.duracaoMinutos !== undefined)
      dadosAtualizados.duracaoMinutos = data.duracaoMinutos;

    try {
      return await this.prisma.atendimento.update({
        where: { id },
        data: dadosAtualizados,
      });
    } catch (error) {
      console.error('Erro no Prisma ao atualizar agendamento:', error);
      throw new InternalServerErrorException(
        'Erro ao atualizar a sessão no banco de dados.',
      );
    }
  }

  // Troca explícita e auditável de status (confirmar/cancelar manualmente),
  // separada do update geral — mesmo padrão de AprendentesService.atualizarFase().
  async atualizarStatus(
    id: string,
    status: StatusAtendimento,
    usuarioId: string,
  ) {
    await this.findOne(id, usuarioId);

    return this.prisma.atendimento.update({
      where: { id },
      data: { status },
    });
  }

  async remove(id: string, usuarioId: string) {
    await this.findOne(id, usuarioId);

    return this.prisma.atendimento.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
