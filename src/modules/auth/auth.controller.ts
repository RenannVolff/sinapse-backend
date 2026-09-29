import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { VerificarEmailDto } from './dto/verificar-email.dto';
import { ReenviarVerificacaoDto } from './dto/reenviar-verificacao.dto';
import { EsqueciSenhaDto } from './dto/esqueci-senha.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';
import { IsPublic } from './decorators/is-public.decorator';
import {
  honeypotAcionado,
  loginFalso,
} from '../../common/honeypot/honeypot';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @IsPublic()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Realiza o login e retorna o Token JWT' })
  login(@Body() loginDto: LoginDto) {
    if (honeypotAcionado(loginDto.website, 'POST /auth/login')) {
      return loginFalso(loginDto.email);
    }
    return this.authService.login(loginDto);
  }

  @IsPublic()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Get('verificar-email')
  @ApiOperation({ summary: 'Confirma o cadastro a partir do token enviado por e-mail' })
  verificarEmail(@Query() query: VerificarEmailDto) {
    return this.authService.verificarEmail(query.token);
  }

  // Cada chamada dispara um e-mail real
  @IsPublic()
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  @Post('reenviar-verificacao')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenvia o e-mail de confirmação de cadastro' })
  reenviarVerificacao(@Body() dto: ReenviarVerificacaoDto) {
    return this.authService.reenviarVerificacao(dto.email);
  }

  // Cada chamada dispara um e-mail real
  @IsPublic()
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  @Post('esqueci-senha')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicita o envio do link de redefinição de senha' })
  esqueciSenha(@Body() dto: EsqueciSenhaDto) {
    return this.authService.esqueciSenha(dto.email);
  }

  @IsPublic()
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  @Post('redefinir-senha')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Redefine a senha a partir do token enviado por e-mail' })
  redefinirSenha(@Body() dto: RedefinirSenhaDto) {
    return this.authService.redefinirSenha(dto.token, dto.novaSenha);
  }
}
