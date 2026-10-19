import { isIP } from 'node:net';

// Cabeçalhos com o IP real do visitante, em ordem de preferência. No Render
// a requisição passa pela Cloudflare, e o req.ip (via trust proxy) vira o
// endereço da borda da Cloudflare, que muda a cada requisição.
const CABECALHOS_IP = ['cf-connecting-ip', 'true-client-ip'] as const;

interface RequisicaoComIp {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}

// Só aceita um único endereço IPv4/IPv6 válido. Listas ("a, b"), valores
// repetidos (array), vazios ou malformados são descartados.
function ipValido(valor: string | string[] | undefined): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const ip = valor.trim();
  return isIP(ip) ? ip : undefined;
}

// Identificador do cliente para o rate limit.
export function obterIpCliente(req: RequisicaoComIp): string | undefined {
  for (const cabecalho of CABECALHOS_IP) {
    const ip = ipValido(req.headers?.[cabecalho]);
    if (ip) return ip;
  }
  return req.ip;
}
