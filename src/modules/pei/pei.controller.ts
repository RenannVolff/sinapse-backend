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
import { PeiService } from './pei.service';
import { CreatePeiDto } from './dto/create-pei.dto';
import { UpdatePeiDto } from './dto/update-pei.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('PEI')
@Controller('peis')
export class PeiController {
  constructor(private readonly peiService: PeiService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um PEI (Plano Educacional Individualizado)' })
  create(
    @Body() createDto: CreatePeiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.peiService.create(createDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lista os PEIs, opcionalmente filtrados por aprendente' })
  @ApiQuery({ name: 'aprendenteId', required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('aprendenteId') aprendenteId?: string,
  ) {
    return this.peiService.findAll(user.id, aprendenteId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um PEI específico' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.peiService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um PEI' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePeiDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.peiService.update(id, updateDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui (soft delete) um PEI' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.peiService.remove(id, user.id);
  }
}
