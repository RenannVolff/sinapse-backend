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
import { PeiTemplateService } from './pei-template.service';
import { CreatePeiTemplateDto } from './dto/create-pei-template.dto';
import { UpdatePeiTemplateDto } from './dto/update-pei-template.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('PeiTemplate')
@Controller('pei-templates')
export class PeiTemplateController {
  constructor(private readonly peiTemplateService: PeiTemplateService) {}

  @Post()
  @ApiOperation({ summary: 'Cria um molde reutilizável de PEI' })
  create(
    @Body() createDto: CreatePeiTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.peiTemplateService.create(createDto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Lista os moldes de PEI do terapeuta' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.peiTemplateService.findAll(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca um molde de PEI específico' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.peiTemplateService.findOne(id, user.id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza um molde de PEI' })
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdatePeiTemplateDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.peiTemplateService.update(id, updateDto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Exclui (soft delete) um molde de PEI' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.peiTemplateService.remove(id, user.id);
  }
}
