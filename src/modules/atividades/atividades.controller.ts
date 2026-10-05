import { Controller, Post, Body, Patch, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AtividadesService } from './atividades.service';
import { CreateAtividadeDto } from './dto/create-atividade.dto';
import { UpdateChecklistDto } from './dto/update-checklist.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Atividades')
@Controller('atividades')
export class AtividadesController {
  constructor(private readonly atividadesService: AtividadesService) {}

  @Post()
  @ApiOperation({ summary: 'Cria uma atividade com 5 tentativas' })
  create(
    @Body() createDto: CreateAtividadeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.atividadesService.create(createDto, user.id);
  }

  @Patch('checklist/:id')
  @ApiOperation({ summary: 'Marca ou desmarca uma tentativa (Checklist)' })
  updateChecklist(
    @Param('id') id: string,
    @Body() updateDto: UpdateChecklistDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.atividadesService.updateChecklist(
      id,
      updateDto.realizado,
      user.id,
    );
  }
}
