import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { AtendimentosService } from './atendimentos.service';
import { CreateAtendimentoDto } from './dto/create-atendimento.dto';

@Controller('atendimentos')
export class AtendimentosController {
  constructor(private readonly service: AtendimentosService) {}

  @Post()
  create(@Body() dto: CreateAtendimentoDto) {
    return this.service.create(dto);
  }

  @Get('aluno/:id')
  findByAluno(@Param('id') id: string) {
    return this.service.findAllByAluno(id);
  }

  @Get('calendario')
  findByMonth(@Query('mes') mes: string, @Query('ano') ano: string) {
    return this.service.findByMonth(Number(mes), Number(ano));
  }
}
