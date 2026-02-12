import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Delete,
} from '@nestjs/common';
import { AtendimentosService } from './atendimentos.service';
import { CreateAtendimentoDto } from './dto/create-atendimento.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

// Este controller é responsável por gerenciar os atendimentos, que são os agendamentos feitos pelos alunos para receberem atendimento dos profissionais. Ele inclui rotas para criar, listar, atualizar e remover atendimentos, além de uma rota específica para alimentar o calendário mensal.
@ApiTags('Atendimentos (Calendário)')
@Controller('atendimentos')
export class AtendimentosController {
  constructor(private readonly service: AtendimentosService) {}
  // Rota para criar um novo atendimento (agendamento)
  @Post()
  @ApiOperation({ summary: 'Cria um novo agendamento' })
  create(@Body() dto: CreateAtendimentoDto) {
    return this.service.create(dto);
  }
  // Rota para listar todos os atendimentos
  @Get('aluno/:id')
  @ApiOperation({ summary: 'Histórico de atendimentos de um aluno' })
  findByAluno(@Param('id') id: string) {
    return this.service.findAllByAluno(id);
  }
  // Rota para listar atendimentos por mês, usada para alimentar o calendário
  @Get('calendario')
  @ApiOperation({ summary: 'Busca atendimentos por mês (para o calendário)' })
  findByMonth(@Query('mes') mes: string, @Query('ano') ano: string) {
    return this.service.findByMonth(Number(mes), Number(ano));
  }
  // Rota para reagendar um atendimento, mudando sua data (usada no Drag & Drop do calendário)
  @Patch(':id/reagendar')
  @ApiOperation({ summary: 'Muda a data de um atendimento (Drag & Drop)' })
  updateData(@Param('id') id: string, @Body('novaData') novaData: string) {
    return this.service.updateData(id, novaData);
  }
  // Rota para remover um atendimento do sistema
  @Delete(':id')
  @ApiOperation({ summary: 'Remove um agendamento do sistema' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
