import { obterIpCliente } from './ip-cliente';

const REQ_IP = '172.68.0.1';

describe('obterIpCliente', () => {
  it('usa o cf-connecting-ip quando é um IPv4 válido', () => {
    expect(
      obterIpCliente({
        ip: REQ_IP,
        headers: { 'cf-connecting-ip': '203.0.113.7' },
      }),
    ).toBe('203.0.113.7');
  });

  it('aceita IPv6 no cf-connecting-ip', () => {
    expect(
      obterIpCliente({
        ip: REQ_IP,
        headers: { 'cf-connecting-ip': '2001:db8::1' },
      }),
    ).toBe('2001:db8::1');
  });

  it('dá precedência ao cf-connecting-ip sobre o true-client-ip', () => {
    expect(
      obterIpCliente({
        ip: REQ_IP,
        headers: {
          'cf-connecting-ip': '203.0.113.7',
          'true-client-ip': '198.51.100.9',
        },
      }),
    ).toBe('203.0.113.7');
  });

  it('usa o true-client-ip quando o cf-connecting-ip está ausente', () => {
    expect(
      obterIpCliente({
        ip: REQ_IP,
        headers: { 'true-client-ip': '198.51.100.9' },
      }),
    ).toBe('198.51.100.9');
  });

  it('usa o true-client-ip quando o cf-connecting-ip é inválido', () => {
    expect(
      obterIpCliente({
        ip: REQ_IP,
        headers: {
          'cf-connecting-ip': 'nao-e-ip',
          'true-client-ip': '198.51.100.9',
        },
      }),
    ).toBe('198.51.100.9');
  });

  it.each([
    ['inválido', 'nao-e-ip'],
    ['vazio', ''],
    ['só espaços', '   '],
    ['IPv4 malformado', '999.1.1.1'],
    ['lista de endereços', '203.0.113.7, 198.51.100.9'],
    ['lista sem espaço', '203.0.113.7,198.51.100.9'],
  ])('ignora valor %s e cai para o req.ip', (_caso, valor) => {
    expect(
      obterIpCliente({
        ip: REQ_IP,
        headers: { 'cf-connecting-ip': valor, 'true-client-ip': valor },
      }),
    ).toBe(REQ_IP);
  });

  it('ignora cabeçalho repetido (array) e cai para o req.ip', () => {
    expect(
      obterIpCliente({
        ip: REQ_IP,
        headers: { 'cf-connecting-ip': ['203.0.113.7', '198.51.100.9'] },
      }),
    ).toBe(REQ_IP);
  });

  it('usa o req.ip quando nenhum cabeçalho está presente', () => {
    expect(obterIpCliente({ ip: REQ_IP, headers: {} })).toBe(REQ_IP);
    expect(obterIpCliente({ ip: REQ_IP })).toBe(REQ_IP);
  });
});
