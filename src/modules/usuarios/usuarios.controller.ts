import {
  Controller,
  Post,
  Body,
  Patch,
  Param,
  ForbiddenException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { IsPublic } from '../auth/decorators/is-public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import {
  cadastroFalso,
  honeypotAcionado,
} from '../../common/honeypot/honeypot';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @IsPublic() //
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post()
  create(@Body() createUsuarioDto: CreateUsuarioDto) {
    if (honeypotAcionado(createUsuarioDto.website, 'POST /usuarios')) {
      return cadastroFalso(createUsuarioDto.nome, createUsuarioDto.email);
    }
    return this.usuariosService.create(createUsuarioDto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // O :id da rota é mantido por consistência REST, mas só pode ser o próprio
    // usuário autenticado; o id efetivo vem sempre do JWT.
    if (id !== user.id) {
      throw new ForbiddenException(
        'Você só pode alterar os dados da sua própria conta.',
      );
    }
    return this.usuariosService.update(user.id, updateUsuarioDto);
  }
}
