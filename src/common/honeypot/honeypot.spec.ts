import { Logger } from '@nestjs/common';
import { honeypotAcionado } from './honeypot';

describe('honeypotAcionado', () => {
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });

  afterEach(() => warn.mockRestore());

  it('detecta como bot quando o campo honeypot vem preenchido', () => {
    expect(honeypotAcionado('http://spam.example', '/auth/login')).toBe(true);
  });

  it('registra apenas a rota no log, nunca o valor enviado', () => {
    honeypotAcionado('conteudo-do-bot', '/usuarios');

    expect(warn).toHaveBeenCalledTimes(1);
    const mensagem = String(warn.mock.calls[0][0]);
    expect(mensagem).toContain('/usuarios');
    expect(mensagem).not.toContain('conteudo-do-bot');
  });

  it('não detecta como bot quando o campo vem vazio', () => {
    expect(honeypotAcionado('', '/auth/login')).toBe(false);
  });

  it('não detecta como bot quando o campo contém só espaços', () => {
    expect(honeypotAcionado('   ', '/auth/login')).toBe(false);
  });

  it('não detecta como bot quando o campo está ausente', () => {
    expect(honeypotAcionado(undefined, '/auth/login')).toBe(false);
    expect(warn).not.toHaveBeenCalled();
  });
});
