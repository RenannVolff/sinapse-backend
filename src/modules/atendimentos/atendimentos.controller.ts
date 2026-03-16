import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AtendimentosService } from './atendimentos.service';

interface CreateAtendimentoBody {
  alunoId: string;
  dataAtendimento: string;
  tituloSessao: string;
  observacoes?: string;
}

@ApiTags('Atendimentos')
@Controller('atendimentos')
export class AtendimentosController {
  constructor(private readonly atendimentosService: AtendimentosService) {}

  @Post()
  @ApiOperation({ summary: 'Agenda uma nova sessão para o paciente' })
  create(@Body() createDto: CreateAtendimentoBody) {
    return this.atendimentosService.create(createDto);
  }

  @Get('calendario')
  @ApiOperation({ summary: 'Busca as sessões para a listagem da agenda' })
  findAll(@Query('mes') mes: string, @Query('ano') ano: string) {
    // Converte os query params de string para número de forma segura
    return this.atendimentosService.findAllCalendario(Number(mes), Number(ano));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca os detalhes completos de uma sessão ativa' })
  findOne(@Param('id') id: string) {
    return this.atendimentosService.findOne(id);
  }
}
