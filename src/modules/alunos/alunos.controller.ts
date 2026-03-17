import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AlunosService } from './alunos.service';

interface CreateAlunoBody {
  nomeCompleto: string;
  dataNascimento: string;
  responsavel: string;
  contato: string;
  usuarioId: string;
}

@ApiTags('Alunos')
@Controller('alunos')
export class AlunosController {
  constructor(private readonly alunosService: AlunosService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastra um novo aluno/paciente' })
  create(@Body() createDto: CreateAlunoBody) {
    return this.alunosService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista todos os alunos' })
  findAll() {
    return this.alunosService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca os detalhes e histórico de um aluno' })
  findOne(@Param('id') id: string) {
    return this.alunosService.findOne(id);
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
  ) {
    return this.alunosService.gerarRelatorioInteligente(id, inicio, fim);
  }
}
