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

@ApiTags('Atendimentos (Calendário)')
@Controller('atendimentos')
export class AtendimentosController {
  constructor(private readonly service: AtendimentosService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um novo agendamento' })
  create(@Body() dto: CreateAtendimentoDto) {
    return this.service.create(dto);
  }

  @Get('aluno/:id')
  @ApiOperation({ summary: 'Histórico de atendimentos de um aluno' })
  findByAluno(@Param('id') id: string) {
    return this.service.findAllByAluno(id);
  }

  @Get('calendario')
  @ApiOperation({ summary: 'Busca atendimentos por mês (para o calendário)' })
  findByMonth(@Query('mes') mes: string, @Query('ano') ano: string) {
    return this.service.findByMonth(Number(mes), Number(ano));
  }

  @Patch(':id/reagendar')
  @ApiOperation({ summary: 'Muda a data de um atendimento (Drag & Drop)' })
  updateData(@Param('id') id: string, @Body('novaData') novaData: string) {
    return this.service.updateData(id, novaData);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove um agendamento do sistema' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
