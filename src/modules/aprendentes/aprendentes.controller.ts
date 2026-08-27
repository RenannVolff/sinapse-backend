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
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AprendentesService } from './aprendentes.service';
import { CreateAprendenteDto } from './dto/create-aprendente.dto';
import { UpdateFaseAprendenteDto } from './dto/update-fase-aprendente.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Aprendentes')
@Controller('aprendentes')
export class AprendentesController {
  constructor(private readonly aprendentesService: AprendentesService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastra um novo aprendente/paciente' })
  create(
    @Body() createDto: CreateAprendenteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aprendentesService.create(createDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lista todos os aprendentes' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.aprendentesService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca os detalhes e histórico de um aprendente' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.aprendentesService.findOne(id, user.id);
  }

  @Patch(':id/fase')
  @ApiOperation({
    summary:
      'Atualiza explicitamente a fase (linha de base/intervenção) do aprendente',
  })
  atualizarFase(
    @Param('id') id: string,
    @Body() updateFaseDto: UpdateFaseAprendenteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aprendentesService.atualizarFase(
      id,
      updateFaseDto.fase,
      user.id,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Exclui (soft delete) um aprendente e seus atendimentos relacionados',
  })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.aprendentesService.remove(id, user.id);
  }

  // --- ROTA ATUALIZADA: Recebe as datas de Início e Fim da URL ---
  @Get(':id/relatorio-ia')
  @ApiOperation({ summary: 'Gera gráfico e laudo de IA filtrado por data' })
  @ApiQuery({
    name: 'inicio',
    required: true,
    description: 'Data de início (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'fim',
    required: true,
    description: 'Data de fim (YYYY-MM-DD)',
  })
  getRelatorioCompleto(
    @Param('id') id: string,
    @Query('inicio') inicio: string,
    @Query('fim') fim: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.aprendentesService.gerarRelatorioInteligente(
      id,
      inicio,
      fim,
      user.id,
    );
  }
}
