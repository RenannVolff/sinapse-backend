import {
  Injectable,
  NotFoundException,
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
} from 'class-validator'; // Importações de Segurança

// DTOs blindados para o NestJS aceitar os dados
export class CreateAtendimentoDto {
  @IsNotEmpty({ message: 'O identificador do aprendente é obrigatório.' })
  @IsString()
  aprendenteId!: string;

  @IsNotEmpty({ message: 'A data do atendimento é obrigatória.' })
  dataAtendimento!: string | Date;

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

@Injectable()
export class AtendimentosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAtendimentoDto, usuarioId: string) {
    const aprendente = await this.prisma.aprendente.findFirst({
      where: { id: data.aprendenteId, usuarioId, deletedAt: null },
    });
    if (!aprendente) throw new NotFoundException('Aprendente não encontrado.');

    try {
      return await this.prisma.atendimento.create({
        data: {
          aprendenteId: data.aprendenteId,
          dataAtendimento: new Date(data.dataAtendimento),
          tituloSessao: data.tituloSessao,
          observacoes: data.observacoes,
          status: StatusAtendimento.AGENDADO,
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

  async remove(id: string, usuarioId: string) {
    await this.findOne(id, usuarioId);

    return this.prisma.atendimento.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
