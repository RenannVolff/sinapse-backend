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
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TarefasService } from './tarefas.service';
import { CreateTarefaDto } from './dto/create-tarefa.dto';
import { UpdateTarefaDto } from './dto/update-tarefa.dto';
import { ListarTarefasQueryDto } from './dto/listar-tarefas-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiBearerAuth()
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
  @ApiOperation({
    summary: 'Lista as tarefas do terapeuta logado',
    description:
      'Pendentes primeiro, depois as mais recentes. Sem `pagina`/`porPagina` ' +
      'devolve a lista completa; com eles, devolve { itens, total, pagina, ' +
      'porPagina }. O total também vai no cabeçalho X-Total-Count.',
  })
  async findAll(
    @Query() query: ListarTarefasQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { total, resultado } = await this.tarefasService.findAll(
      user.id,
      query,
    );
    res.setHeader('X-Total-Count', String(total));
    return resultado;
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
