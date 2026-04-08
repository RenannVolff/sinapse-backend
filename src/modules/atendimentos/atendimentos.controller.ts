import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
} from '@nestjs/common';

import {
  AtendimentosService,
  CreateAtendimentoDto,
  UpdateAtendimentoDto,
} from './atendimentos.service';

@Controller('atendimentos')
export class AtendimentosController {
  constructor(private readonly atendimentosService: AtendimentosService) {}

  @Post()
  create(@Body() createDto: CreateAtendimentoDto) {
    return this.atendimentosService.create(createDto);
  }

  @Get('calendario')
  findAll(@Query('mes') mes: string, @Query('ano') ano: string) {
    return this.atendimentosService.findAllCalendario(Number(mes), Number(ano));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.atendimentosService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: UpdateAtendimentoDto) {
    return this.atendimentosService.update(id, updateDto);
  }
}
