import { Logger } from '@nestjs/common';
import { honeypotAcionado, loginFalso } from './honeypot';

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

describe('loginFalso', () => {
  const FORMATO_NOME = /^[A-ZÀ-Ú][a-zà-ú]+ [A-ZÀ-Ú][a-zà-ú]+$/;

  it('devolve um nome plausível (nome e sobrenome), nunca vazio', () => {
    const { usuario } = loginFalso('alguem@exemplo.com');
    expect(usuario.nome).toMatch(FORMATO_NOME);
  });

  it('devolve sempre o mesmo nome para o mesmo e-mail, como uma conta real', () => {
    const email = 'repetido@exemplo.com';
    expect(loginFalso(email).usuario.nome).toBe(loginFalso(email).usuario.nome);
  });

  it('varia o nome entre e-mails diferentes', () => {
    const nomes = new Set(
      Array.from(
        { length: 30 },
        (_, i) => loginFalso(`pessoa${i}@exemplo.com`).usuario.nome,
      ),
    );
    expect(nomes.size).toBeGreaterThan(5);
  });

  it('mantém o mesmo formato do login real', () => {
    const resposta = loginFalso('formato@exemplo.com');
    expect(Object.keys(resposta).sort()).toEqual(['token', 'usuario']);
    expect(Object.keys(resposta.usuario).sort()).toEqual([
      'duploFatorAtivo',
      'email',
      'id',
      'nome',
    ]);
    expect(resposta.usuario.email).toBe('formato@exemplo.com');
  });
});
