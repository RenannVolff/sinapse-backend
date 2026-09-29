import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';
import { DoisFatoresService } from './dois-fatores.service';

export interface JwtPayload {
  sub: string;
  email: string;
  // Presente só no token temporário do login com 2FA. A JwtStrategy recusa
  // qualquer token que tenha esse claim.
  tipo?: typeof TIPO_TOKEN_PRE_AUTH_2FA;
}

export const TIPO_TOKEN_PRE_AUTH_2FA = 'pre_auth_2fa';
const VALIDADE_TOKEN_PRE_AUTH_2FA = '5m';

const MENSAGEM_REENVIO_GENERICA =
  'Se este e-mail estiver cadastrado e pendente de verificação, um novo link de confirmação foi enviado.';

const MENSAGEM_ESQUECI_SENHA_GENERICA =
  'Se este e-mail estiver cadastrado, enviamos um link de redefinição de senha.';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly usuariosService: UsuariosService,
    private readonly doisFatoresService: DoisFatoresService,
    config: ConfigService,
  ) {
    // Segredo próprio para o token temporário do 2FA, derivado do JWT_SECRET:
    // mesmo se a checagem do claim `tipo` falhasse, o token temporário nunca
    // passaria na validação de assinatura da JwtStrategy.
    this.segredoPreAuth2fa = crypto
      .createHmac('sha256', config.getOrThrow<string>('JWT_SECRET'))
      .update(TIPO_TOKEN_PRE_AUTH_2FA)
      .digest('hex');
  }

  private readonly segredoPreAuth2fa: string;

  async login(dados: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dados.email },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (!usuario.emailVerificado) {
      throw new ForbiddenException(
        'Confirme seu e-mail antes de fazer login. Verifique sua caixa de entrada ou solicite um novo link em /auth/reenviar-verificacao.',
      );
    }

    const senhaValida = await bcrypt.compare(dados.senha, usuario.senhaHash);

    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    // Com 2FA ativo, a senha sozinha não basta: devolve só um token
    // temporário, que precisa ser trocado em /auth/2fa/verificar-login
    // junto com o código do app autenticador.
    if (usuario.duploFatorAtivo) {
      const payloadPreAuth: JwtPayload = {
        sub: usuario.id,
        email: usuario.email,
        tipo: TIPO_TOKEN_PRE_AUTH_2FA,
      };
      return {
        pendente2fa: true,
        tokenTemporario: await this.jwtService.signAsync(payloadPreAuth, {
          secret: this.segredoPreAuth2fa,
          expiresIn: VALIDADE_TOKEN_PRE_AUTH_2FA,
        }),
      };
    }

    return this.emitirSessao(usuario);
  }

  // Segunda etapa do login com 2FA: troca o token temporário + código do app
  // (ou código de backup) pelo JWT final, no mesmo formato do login comum.
  async verificarLoginDoisFatores(tokenTemporario: string, codigo: string) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(tokenTemporario, {
        secret: this.segredoPreAuth2fa,
      });
    } catch {
      throw new UnauthorizedException(
        'Sessão de verificação inválida ou expirada. Faça login novamente.',
      );
    }

    if (payload.tipo !== TIPO_TOKEN_PRE_AUTH_2FA) {
      throw new UnauthorizedException(
        'Sessão de verificação inválida ou expirada. Faça login novamente.',
      );
    }

    const codigoValido = await this.doisFatoresService.verificarCodigo(
      payload.sub,
      codigo,
    );
    if (!codigoValido) {
      throw new UnauthorizedException('Código de verificação inválido.');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: payload.sub },
    });
    if (!usuario) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    return this.emitirSessao(usuario);
  }

  // Desligar o 2FA exige a senha atual: um JWT roubado sozinho não basta
  // para remover a proteção da conta.
  async desativarDoisFatores(
    usuarioId: string,
    senha: string,
  ): Promise<{ mensagem: string }> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });

    // 403 (e não 401) para senha errada: o 401 é reservado a sessão
    // inválida, e o front desloga o usuário ao recebê-lo.
    if (!usuario || !(await bcrypt.compare(senha, usuario.senhaHash))) {
      throw new ForbiddenException('Senha incorreta.');
    }

    await this.doisFatoresService.desativar(usuarioId);

    return { mensagem: 'Autenticação de dois fatores desativada.' };
  }

  private async emitirSessao(usuario: {
    id: string;
    nome: string;
    email: string;
    duploFatorAtivo: boolean;
  }) {
    const payload: JwtPayload = { sub: usuario.id, email: usuario.email };

    return {
      token: await this.jwtService.signAsync(payload),
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        duploFatorAtivo: usuario.duploFatorAtivo,
      },
    };
  }

  // Confirma o cadastro a partir do token de verificação enviado por e-mail.
  // Compara o HASH do token recebido (nunca o valor puro é armazenado) e
  // exige prazo ainda válido.
  async verificarEmail(tokenPuro: string): Promise<{ mensagem: string }> {
    const tokenHash = crypto.createHash('sha256').update(tokenPuro).digest('hex');

    const usuario = await this.prisma.usuario.findFirst({
      where: { tokenVerificacao: tokenHash },
    });

    if (
      !usuario ||
      !usuario.tokenVerificacaoExpiraEm ||
      usuario.tokenVerificacaoExpiraEm < new Date()
    ) {
      throw new BadRequestException(
        'Token de verificação inválido ou expirado. Solicite um novo em /auth/reenviar-verificacao.',
      );
    }

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        emailVerificado: true,
        tokenVerificacao: null,
        tokenVerificacaoExpiraEm: null,
      },
    });

    return { mensagem: 'E-mail verificado com sucesso. Você já pode fazer login.' };
  }

  // Reenvia o e-mail de verificação SE o usuário existir e ainda não tiver
  // confirmado o cadastro — mas sempre responde com a mesma mensagem
  // genérica, pra não revelar se aquele e-mail existe no sistema.
  async reenviarVerificacao(email: string): Promise<{ mensagem: string }> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });

    if (usuario && !usuario.emailVerificado) {
      await this.usuariosService.gerarEEnviarTokenVerificacao(
        usuario.id,
        usuario.email,
      );
    }

    return { mensagem: MENSAGEM_REENVIO_GENERICA };
  }

  // Envia o link de redefinição de senha SE o e-mail existir no sistema —
  // mas sempre responde com a mesma mensagem genérica, pra não revelar se
  // aquele e-mail está cadastrado (mesma proteção contra enumeração da
  // verificação de e-mail).
  async esqueciSenha(email: string): Promise<{ mensagem: string }> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });

    if (usuario) {
      await this.usuariosService.gerarEEnviarTokenRecuperacaoSenha(
        usuario.id,
        usuario.email,
      );
    }

    return { mensagem: MENSAGEM_ESQUECI_SENHA_GENERICA };
  }

  // Confirma a redefinição a partir do token enviado por e-mail. Compara o
  // HASH do token recebido (nunca o valor puro é armazenado) e exige prazo
  // ainda válido. O token é de uso único: é limpo assim que a senha é
  // trocada, então não pode ser reaproveitado numa segunda tentativa.
  async redefinirSenha(
    tokenPuro: string,
    novaSenha: string,
  ): Promise<{ mensagem: string }> {
    const tokenHash = crypto.createHash('sha256').update(tokenPuro).digest('hex');

    const usuario = await this.prisma.usuario.findFirst({
      where: { tokenRecuperacaoSenha: tokenHash },
    });

    if (
      !usuario ||
      !usuario.tokenRecuperacaoExpiraEm ||
      usuario.tokenRecuperacaoExpiraEm < new Date()
    ) {
      throw new BadRequestException(
        'Token de recuperação inválido ou expirado. Solicite uma nova redefinição em /auth/esqueci-senha.',
      );
    }

    const senhaHash = await bcrypt.hash(novaSenha, 10);

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        senhaHash,
        tokenRecuperacaoSenha: null,
        tokenRecuperacaoExpiraEm: null,
      },
    });

    return { mensagem: 'Senha redefinida com sucesso. Você já pode fazer login.' };
  }
}
