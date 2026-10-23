import { promises as dns } from 'dns';
import { validate } from 'class-validator';
import { EmailReal } from './email-real.validator';

class ComEmail {
  @EmailReal()
  email!: string;
}

async function mensagens(email: string): Promise<string[]> {
  const obj = Object.assign(new ComEmail(), { email });
  const erros = await validate(obj);
  return erros.flatMap((e) => Object.values(e.constraints ?? {}));
}

function erroDns(code: string) {
  return Object.assign(new Error(code), { code });
}

describe('EmailReal — checagem de MX', () => {
  afterEach(() => jest.restoreAllMocks());

  it('recusa domínio que o DNS diz não existir', async () => {
    jest.spyOn(dns, 'resolveMx').mockRejectedValue(erroDns('ENOTFOUND'));
    expect(await mensagens('ana@dominio-que-nao-existe.com.br')).toEqual([
      expect.stringContaining('não recebe e-mails'),
    ]);
  });

  it('aceita domínio com MX', async () => {
    jest
      .spyOn(dns, 'resolveMx')
      .mockResolvedValue([{ exchange: 'mx.exemplo.com', priority: 10 }]);
    expect(await mensagens('ana@exemplo.com')).toEqual([]);
  });

  it('NÃO bloqueia quando o DNS falha (timeout, servidor fora)', async () => {
    jest.spyOn(dns, 'resolveMx').mockRejectedValue(erroDns('ETIMEOUT'));
    expect(await mensagens('ana@exemplo.com')).toEqual([]);

    jest.spyOn(dns, 'resolveMx').mockRejectedValue(erroDns('ESERVFAIL'));
    expect(await mensagens('ana@exemplo.com')).toEqual([]);
  });

  it('sem MX, aceita se o domínio tiver endereço (regra da RFC 5321)', async () => {
    jest.spyOn(dns, 'resolveMx').mockRejectedValue(erroDns('ENODATA'));
    jest.spyOn(dns, 'resolve').mockResolvedValue(['203.0.113.10']);
    expect(await mensagens('ana@exemplo.com')).toEqual([]);
  });
});
