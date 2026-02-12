import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { AlunosService } from './alunos.service';
import { CreateAlunoDto } from './dto/create-aluno.dto';

// Controller para gerenciar alunos/aprendentes
@Controller('alunos')
export class AlunosController {
  constructor(private readonly alunosService: AlunosService) {}
  // Rota para criar um novo aluno/aprendente
  @Post()
  create(@Body() createAlunoDto: CreateAlunoDto) {
    return this.alunosService.create(createAlunoDto);
  }
  // Rota para listar todos os alunos/aprendentes
  @Get()
  findAll() {
    return this.alunosService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.alunosService.findOne(id);
  }
}
