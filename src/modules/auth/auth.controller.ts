import { Controller, Get, Post, Body, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { DoisFatoresService } from './dois-fatores.service';
import { LoginDto } from './dto/login.dto';
import { VerificarEmailDto } from './dto/verificar-email.dto';
import { ReenviarVerificacaoDto } from './dto/reenviar-verificacao.dto';
import { EsqueciSenhaDto } from './dto/esqueci-senha.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';
import { AtivarDoisFatoresDto } from './dto/ativar-dois-fatores.dto';
import { DesativarDoisFatoresDto } from './dto/desativar-dois-fatores.dto';
import { VerificarLoginDoisFatoresDto } from './dto/verificar-login-dois-fatores.dto';
import { IsPublic } from './decorators/is-public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  honeypotAcionado,
  loginFalso,
} from '../../common/honeypot/honeypot';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly doisFatoresService: DoisFatoresService,
  ) {}

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

  @Post('2fa/gerar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gera o segredo TOTP e o QR code (2FA ainda inativo)' })
  gerarDoisFatores(@CurrentUser('id') usuarioId: string) {
    return this.doisFatoresService.gerarSegredo(usuarioId);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('2fa/ativar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ativa o 2FA e devolve os códigos de backup (exibidos uma única vez)' })
  ativarDoisFatores(
    @CurrentUser('id') usuarioId: string,
    @Body() dto: AtivarDoisFatoresDto,
  ) {
    return this.doisFatoresService.ativar(usuarioId, dto.codigo);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('2fa/desativar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desativa o 2FA (exige a senha atual)' })
  desativarDoisFatores(
    @CurrentUser('id') usuarioId: string,
    @Body() dto: DesativarDoisFatoresDto,
  ) {
    return this.authService.desativarDoisFatores(usuarioId, dto.senha);
  }

  // Mesmo limite do login: segura força bruta nos 10^6 códigos possíveis
  // durante os 5 minutos de validade do token temporário.
  @IsPublic()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('2fa/verificar-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Conclui o login com 2FA e retorna o Token JWT' })
  verificarLoginDoisFatores(@Body() dto: VerificarLoginDoisFatoresDto) {
    return this.authService.verificarLoginDoisFatores(
      dto.tokenTemporario,
      dto.codigo,
    );
  }
}
