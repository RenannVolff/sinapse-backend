import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { VerificarEmailDto } from './dto/verificar-email.dto';
import { ReenviarVerificacaoDto } from './dto/reenviar-verificacao.dto';
import { IsPublic } from './decorators/is-public.decorator';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @IsPublic()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Realiza o login e retorna o Token JWT' })
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @IsPublic()
  @Get('verificar-email')
  @ApiOperation({ summary: 'Confirma o cadastro a partir do token enviado por e-mail' })
  verificarEmail(@Query() query: VerificarEmailDto) {
    return this.authService.verificarEmail(query.token);
  }

  @IsPublic()
  @Post('reenviar-verificacao')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenvia o e-mail de confirmação de cadastro' })
  reenviarVerificacao(@Body() dto: ReenviarVerificacaoDto) {
    return this.authService.reenviarVerificacao(dto.email);
  }
}
