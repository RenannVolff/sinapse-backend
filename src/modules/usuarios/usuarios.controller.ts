import { Controller, Get, Post, Body } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsPublic } from '../auth/decorators/is-public.decorator'; // <--- Importante

@ApiTags('Auth') // Mantivemos na tag Auth por conveniência
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @IsPublic() // <--- Libera o cadastro para quem não tem login ainda
  @Post()
  @ApiOperation({ summary: 'Cadastra um novo profissional' })
  create(@Body() createUsuarioDto: CreateUsuarioDto) {
    return this.usuariosService.create(createUsuarioDto);
  }

  // Esta rota é protegida (só admin logado vê a lista)
  @Get()
  @ApiOperation({ summary: 'Lista todos os profissionais (Requer Login)' })
  findAll() {
    return this.usuariosService.findAll();
  }
}
