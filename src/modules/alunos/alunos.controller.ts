import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
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

  // --- NOVA ROTA: Perfil do Aluno ---
  @Get(':id')
  @ApiOperation({ summary: 'Busca os detalhes e histórico de um aluno' })
  findOne(@Param('id') id: string) {
    return this.alunosService.findOne(id);
  }

  @Get(':id/evolucao')
  @ApiOperation({ summary: 'Gera os dados do gráfico matemático de evolução' })
  getEvolucao(@Param('id') id: string) {
    return this.alunosService.gerarDadosEvolucao(id);
  }
}
