import { Controller, Patch, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';

@ApiTags('Usuários')
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza Nome, E-mail ou Senha do Profissional' })
  update(@Param('id') id: string, @Body() updateUsuarioDto: UpdateUsuarioDto) {
    // Agora o NestJS sabe que o updateUsuarioDto já passou pela validação rigorosa!
    return this.usuariosService.update(id, updateUsuarioDto);
  }
}
