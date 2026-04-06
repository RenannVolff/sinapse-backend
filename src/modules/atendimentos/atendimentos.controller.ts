import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
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
    return this.atendimentosService.findAllCalendario(Number(mes), Number(ano));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca os detalhes completos de uma sessão ativa' })
  findOne(@Param('id') id: string) {
    return this.atendimentosService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza os dados de uma sessão (Reagendamento)' })
  update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateAtendimentoBody>,
  ) {
    return this.atendimentosService.update(id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancela e exclui uma sessão agendada' })
  remove(@Param('id') id: string) {
    return this.atendimentosService.remove(id);
  }
}
