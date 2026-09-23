import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter | null;

  constructor() {
    this.transporter =
      process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD
        ? nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
              user: process.env.GMAIL_USER,
              pass: process.env.GMAIL_APP_PASSWORD,
            },
          })
        : null;
  }

  async enviarEmailVerificacao(
    destinatario: string,
    token: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        'GMAIL_USER/GMAIL_APP_PASSWORD não configurados — email de verificação não enviado.',
      );
      return;
    }

    const link = `${process.env.FRONTEND_URL}/verificar-email?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: destinatario,
        subject: 'Confirme seu cadastro no Sinapse Edu',
        text: `Olá!\n\nPara concluir seu cadastro no Sinapse Edu, confirme seu e-mail acessando o link abaixo:\n${link}\n\nEste link expira em 24 horas. Se você não fez esse cadastro, pode ignorar este e-mail.`,
        html: `<p>Olá!</p><p>Para concluir seu cadastro no Sinapse Edu, confirme seu e-mail clicando no link abaixo:</p><p><a href="${link}">${link}</a></p><p>Este link expira em 24 horas. Se você não fez esse cadastro, pode ignorar este e-mail.</p>`,
      });
    } catch (error) {
      // Não loga o destinatário (PII) — só o motivo da falha.
      const mensagem = error instanceof Error ? error.message : String(error);
      this.logger.error(`Falha ao enviar e-mail de verificação: ${mensagem}`);
    }
  }

  async enviarEmailRecuperacaoSenha(
    destinatario: string,
    token: string,
  ): Promise<void> {
    if (!this.transporter) {
      this.logger.warn(
        'GMAIL_USER/GMAIL_APP_PASSWORD não configurados — email de recuperação de senha não enviado.',
      );
      return;
    }

    const link = `${process.env.FRONTEND_URL}/redefinir-senha?token=${token}`;

    try {
      await this.transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: destinatario,
        subject: 'Redefinição de senha — Sinapse Edu',
        text: `Olá!\n\nFoi solicitada a redefinição da sua senha no Sinapse Edu. Para continuar, acesse o link abaixo:\n${link}\n\nEste link expira em 1 hora. Se você não solicitou essa redefinição, pode ignorar este e-mail — sua senha continuará a mesma.`,
        html: `<p>Olá!</p><p>Foi solicitada a redefinição da sua senha no Sinapse Edu. Para continuar, clique no link abaixo:</p><p><a href="${link}">${link}</a></p><p>Este link expira em 1 hora. Se você não solicitou essa redefinição, pode ignorar este e-mail — sua senha continuará a mesma.</p>`,
      });
    } catch (error) {
      // Não loga o destinatário (PII) — só o motivo da falha.
      const mensagem = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Falha ao enviar e-mail de recuperação de senha: ${mensagem}`,
      );
    }
  }
}
