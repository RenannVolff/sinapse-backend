import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: jest.fn() })),
}));

describe('EmailService', () => {
  const envOriginal = { ...process.env };
  const createTransport = nodemailer.createTransport as jest.Mock;

  beforeEach(() => {
    createTransport.mockClear();
    process.env.GMAIL_USER = 'remetente@exemplo.com';
    process.env.GMAIL_APP_PASSWORD = 'senha-de-app';
  });

  afterAll(() => {
    process.env = envOriginal;
  });

  it('cria o transporte SMTP com timeouts de conexão, saudação e socket', () => {
    new EmailService();

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      requireTLS: true,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      auth: { user: 'remetente@exemplo.com', pass: 'senha-de-app' },
    });
  });

  it('não cria transporte sem as credenciais do Gmail', () => {
    delete process.env.GMAIL_APP_PASSWORD;

    new EmailService();

    expect(createTransport).not.toHaveBeenCalled();
  });
});
