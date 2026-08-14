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

import {
  AtendimentosService,
  CreateAtendimentoDto,
  UpdateAtendimentoDto,
} from './atendimentos.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@Controller('atendimentos')
export class AtendimentosController {
  constructor(private readonly atendimentosService: AtendimentosService) {}

  @Post()
  create(
    @Body() createDto: CreateAtendimentoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.atendimentosService.create(createDto, user.id);
  }

  @Get('calendario')
  findAll(
    @Query('mes') mes: string,
    @Query('ano') ano: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.atendimentosService.findAllCalendario(
      Number(mes),
      Number(ano),
      user.id,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.atendimentosService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateAtendimentoDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.atendimentosService.update(id, updateDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.atendimentosService.remove(id, user.id);
  }
}
