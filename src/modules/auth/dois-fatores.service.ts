import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { generateSecret, generateURI, verify } from 'otplib';
import * as QRCode from 'qrcode';
import { PrismaService } from '../../prisma/prisma.service';

const EMISSOR_TOTP = 'Sinapse Edu';

// ±30s = 1 janela TOTP de cada lado, tolera pequena diferença de relógio
// entre o servidor e o celular.
const TOLERANCIA_TOTP_SEGUNDOS = 30;

const QUANTIDADE_CODIGOS_BACKUP = 8;
const TAMANHO_CODIGO_BACKUP = 8;
// Sem 0/O e 1/I/L, que se confundem quando o terapeuta digita o código anotado.
const ALFABETO_CODIGO_BACKUP = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const FORMATO_CODIGO_TOTP = /^\d{6}$/;

function hashSha256(valor: string): string {
  return crypto.createHash('sha256').update(valor).digest('hex');
}

// Aceita o código de backup com espaços, hífens ou minúsculas.
function normalizarCodigoBackup(codigo: string): string {
  return codigo.replace(/[\s-]/g, '').toUpperCase();
}

function gerarCodigoBackup(): string {
  let codigo = '';
  for (let i = 0; i < TAMANHO_CODIGO_BACKUP; i++) {
    codigo += ALFABETO_CODIGO_BACKUP[crypto.randomInt(ALFABETO_CODIGO_BACKUP.length)];
  }
  return codigo;
}

@Injectable()
export class DoisFatoresService {
  constructor(private readonly prisma: PrismaService) {}

  // Gera um segredo novo e o salva SEM ativar: o 2FA só passa a valer depois
  // que o terapeuta prova, em ativar(), que o app autenticador está gerando
  // códigos corretos — evita trancar a conta com um QR code mal escaneado.
  async gerarSegredo(
    usuarioId: string,
  ): Promise<{ segredo: string; qrCodeBase64: string }> {
    const usuario = await this.buscarUsuario(usuarioId);

    // Sobrescrever o segredo com o 2FA ativo invalidaria o app já configurado
    // e trancaria a conta no próximo login.
    if (usuario.duploFatorAtivo) {
      throw new ConflictException(
        'A autenticação de dois fatores já está ativa. Desative-a antes de gerar um novo segredo.',
      );
    }

    const segredo = generateSecret();

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: { duploFatorSegredo: segredo },
    });

    const urlOtpAuth = generateURI({
      issuer: EMISSOR_TOTP,
      label: usuario.email,
      secret: segredo,
    });
    const qrCodeBase64 = await QRCode.toDataURL(urlOtpAuth);

    return { segredo, qrCodeBase64 };
  }

  // Confirma o primeiro código do app e liga o 2FA. Os códigos de backup só
  // são devolvidos em texto puro nesta resposta — no banco fica apenas o
  // HASH, então não há como recuperá-los depois.
  async ativar(
    usuarioId: string,
    codigo: string,
  ): Promise<{ codigosBackup: string[] }> {
    const usuario = await this.buscarUsuario(usuarioId);

    if (usuario.duploFatorAtivo) {
      throw new ConflictException(
        'A autenticação de dois fatores já está ativa.',
      );
    }

    if (!usuario.duploFatorSegredo) {
      throw new BadRequestException(
        'Nenhum segredo gerado. Chame /auth/2fa/gerar antes de ativar.',
      );
    }

    const codigoValido = await this.validarTotp(
      usuario.duploFatorSegredo,
      codigo,
    );
    if (!codigoValido) {
      throw new BadRequestException(
        'Código inválido. Confira o código exibido no app autenticador e tente novamente.',
      );
    }

    const codigosBackup = Array.from(
      { length: QUANTIDADE_CODIGOS_BACKUP },
      gerarCodigoBackup,
    );

    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        duploFatorAtivo: true,
        duploFatorCodigosBackup: codigosBackup.map(hashSha256),
      },
    });

    return { codigosBackup };
  }

  // Aceita código TOTP ou de backup; o de backup é de uso único.
  async verificarCodigo(usuarioId: string, codigo: string): Promise<boolean> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });

    if (!usuario?.duploFatorAtivo || !usuario.duploFatorSegredo) {
      return false;
    }

    const codigoLimpo = codigo.trim();
    if (FORMATO_CODIGO_TOTP.test(codigoLimpo)) {
      return this.validarTotp(usuario.duploFatorSegredo, codigoLimpo);
    }

    const hashBackup = hashSha256(normalizarCodigoBackup(codigoLimpo));
    if (!usuario.duploFatorCodigosBackup.includes(hashBackup)) {
      return false;
    }

    // O `has` no WHERE torna o consumo atômico: se duas requisições usarem o
    // mesmo código ao mesmo tempo, só uma ainda acha o hash na lista; a outra
    // afeta 0 linhas e é recusada.
    const { count } = await this.prisma.usuario.updateMany({
      where: {
        id: usuarioId,
        duploFatorCodigosBackup: { has: hashBackup },
      },
      data: {
        duploFatorCodigosBackup: usuario.duploFatorCodigosBackup.filter(
          (hash) => hash !== hashBackup,
        ),
      },
    });

    return count === 1;
  }

  async desativar(usuarioId: string): Promise<void> {
    await this.prisma.usuario.update({
      where: { id: usuarioId },
      data: {
        duploFatorAtivo: false,
        duploFatorSegredo: null,
        duploFatorCodigosBackup: [],
      },
    });
  }

  private async buscarUsuario(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return usuario;
  }

  private async validarTotp(segredo: string, codigo: string): Promise<boolean> {
    if (!FORMATO_CODIGO_TOTP.test(codigo)) {
      return false;
    }
    const resultado = await verify({
      secret: segredo,
      token: codigo,
      epochTolerance: TOLERANCIA_TOTP_SEGUNDOS,
    });
    return resultado.valid;
  }
}
