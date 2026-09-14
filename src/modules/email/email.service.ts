import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

// Domínio de teste da Resend — funciona sem verificação de domínio próprio,
// mas só entrega pro e-mail associado à conta Resend usada (ok pro TCC).
const REMETENTE_TESTE = 'onboarding@resend.dev';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;

  constructor() {
    this.resend = process.env.RESEND_API_KEY
      ? new Resend(process.env.RESEND_API_KEY)
      : null;
  }

  async enviarEmailVerificacao(
    destinatario: string,
    token: string,
  ): Promise<void> {
    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY não configurada — email de verificação não enviado.',
      );
      return;
    }

    const link = `${process.env.FRONTEND_URL}/verificar-email?token=${token}`;

    const { error } = await this.resend.emails.send({
      from: REMETENTE_TESTE,
      to: destinatario,
      subject: 'Confirme seu cadastro no Sinapse Edu',
      text: `Olá!\n\nPara concluir seu cadastro no Sinapse Edu, confirme seu e-mail acessando o link abaixo:\n${link}\n\nEste link expira em 24 horas. Se você não fez esse cadastro, pode ignorar este e-mail.`,
      html: `<p>Olá!</p><p>Para concluir seu cadastro no Sinapse Edu, confirme seu e-mail clicando no link abaixo:</p><p><a href="${link}">${link}</a></p><p>Este link expira em 24 horas. Se você não fez esse cadastro, pode ignorar este e-mail.</p>`,
    });

    if (error) {
      // Não loga o destinatário (PII) — só o motivo da falha.
      this.logger.error(`Falha ao enviar e-mail de verificação: ${error.message}`);
    }
  }
}
