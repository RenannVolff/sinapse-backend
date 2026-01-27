import { Injectable } from '@nestjs/common';
import { CreateAtendimentoDto } from './dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from './dto/update-atendimento.dto';

@Injectable()
export class AtendimentosService {
  create(createAtendimentoDto: CreateAtendimentoDto) {
    return 'This action adds a new atendimento';
  }

  findAll() {
    return `This action returns all atendimentos`;
  }

  findOne(id: number) {
    return `This action returns a #${id} atendimento`;
  }

  update(id: number, updateAtendimentoDto: UpdateAtendimentoDto) {
    return `This action updates a #${id} atendimento`;
  }

  remove(id: number) {
    return `This action removes a #${id} atendimento`;
  }
}
