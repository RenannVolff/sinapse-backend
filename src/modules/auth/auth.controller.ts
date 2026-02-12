import { Body, Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { IsPublic } from './decorators/is-public.decorator'; // <--- Importante

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @IsPublic() // <--- Libera esta rota da guarda global
  @HttpCode(HttpStatus.OK)
  @Post('login')
  @ApiOperation({ summary: 'Realiza login seguro e retorna Token JWT' })
  @ApiResponse({
    status: 200,
    description: 'Login realizado com sucesso',
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciais inválidas',
  })
  signIn(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }
}
