import { Module } from '@nestjs/common';
import { AtendimentosService } from './atendimentos.service';
import { AtendimentosController } from './atendimentos.controller';
// Este módulo é responsável por gerenciar os atendimentos, que são os agendamentos feitos pelos alunos para receberem atendimento dos profissionais.
// Ele inclui rotas para criar, listar, atualizar e remover atendimentos, além de uma rota específica para alimentar o calendário mensal.
@Module({
  controllers: [AtendimentosController],
  providers: [AtendimentosService],
})
export class AtendimentosModule {}
