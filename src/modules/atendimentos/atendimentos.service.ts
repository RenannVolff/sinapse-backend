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
  Max,
  Min,
} from 'class-validator';
import { IsDateNotInPast } from '../../common/validators/is-date-not-in-past.validator';

export class CreateAtendimentoDto {
  @IsNotEmpty({ message: 'O identificador do aprendente é obrigatório.' })
  @IsString()
  aprendenteId!: string;

  @IsNotEmpty({ message: 'A data do atendimento é obrigatória.' })
  @IsDateString({}, { message: 'Data inválida' })
  @IsDateNotInPast()
  dataAtendimento!: string | Date;

  // Em minutos; usada na checagem de conflito de horário. O teto de 24h é o
  // que garante a margem de busca de verificarConflitoHorario().
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440, { message: 'A duração máxima é de 24h (1440 minutos).' })
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
  @IsDateString({}, { message: 'Data inválida' })
  @IsDateNotInPast()
  dataAtendimento?: string | Date;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1440, { message: 'A duração máxima é de 24h (1440 minutos).' })
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

  // O conflito é por terapeuta, não por aprendente: ele não pode estar em
  // dois atendimentos ao mesmo tempo. CANCELADO libera o horário.
  // `ignorarId` exclui o próprio atendimento numa edição, senão ele sempre
  // colidiria consigo mesmo.
  private async verificarConflitoHorario(
    usuarioId: string,
    inicio: Date,
    fim: Date,
    ignorarId?: string,
  ) {
    // Olha 24h para trás para pegar sessões que começaram antes de `inicio`
    // mas ainda estão em andamento — folga bem acima de qualquer sessão real.
    const margemBusca = new Date(inicio.getTime() - 24 * 60 * 60 * 1000);

    const candidatos = await this.prisma.atendimento.findMany({
      where: {
        aprendente: { usuarioId },
        deletedAt: null,
        status: { not: StatusAtendimento.CANCELADO },
        dataAtendimento: { gte: margemBusca, lt: fim },
        ...(ignorarId ? { id: { not: ignorarId } } : {}),
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
    const atual = await this.findOne(id, usuarioId);

    // Campo omitido no payload mantém o valor atual. Se o atendimento vai
    // ficar CANCELADO, não ocupa horário e não há o que checar.
    const statusFinal = data.status ?? atual.status;
    if (
      (data.dataAtendimento || data.duracaoMinutos !== undefined) &&
      statusFinal !== StatusAtendimento.CANCELADO
    ) {
      const inicio = data.dataAtendimento
        ? new Date(data.dataAtendimento)
        : atual.dataAtendimento;
      const duracao = data.duracaoMinutos ?? atual.duracaoMinutos;
      const fim = new Date(inicio.getTime() + duracao * 60000);
      await this.verificarConflitoHorario(usuarioId, inicio, fim, id);
    }

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

  // Separado do update geral para a troca de status ficar explícita e
  // auditável — mesmo padrão de AprendentesService.atualizarFase().
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
