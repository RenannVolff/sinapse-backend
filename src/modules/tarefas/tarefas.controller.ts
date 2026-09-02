import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TarefasService } from './tarefas.service';
import { CreateTarefaDto } from './dto/create-tarefa.dto';
import { UpdateTarefaDto } from './dto/update-tarefa.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Tarefas')
@Controller('tarefas')
export class TarefasController {
  constructor(private readonly tarefasService: TarefasService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma tarefa' })
  create(
    @Body() createDto: CreateTarefaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tarefasService.create(createDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lista as tarefas do terapeuta logado' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.tarefasService.findAll(user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza uma tarefa' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateTarefaDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tarefasService.update(id, updateDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui (soft delete) uma tarefa' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.tarefasService.remove(id, user.id);
  }
}
