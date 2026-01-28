import { Injectable } from '@nestjs/common';
import { CreateRelatorioDto } from './dto/create-relatorio.dto';
import { UpdateRelatorioDto } from './dto/update-relatorio.dto';

@Injectable()
export class RelatoriosService {
  create(createRelatorioDto: CreateRelatorioDto) {
    return 'This action adds a new relatorio';
  }

  findAll() {
    return `This action returns all relatorios`;
  }

  findOne(id: number) {
    return `This action returns a #${id} relatorio`;
  }

  update(id: number, updateRelatorioDto: UpdateRelatorioDto) {
    return `This action updates a #${id} relatorio`;
  }

  remove(id: number) {
    return `This action removes a #${id} relatorio`;
  }
}
