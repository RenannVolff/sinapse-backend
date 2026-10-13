// Frontend local do Vite, liberado no CORS fora de produção.
const ORIGEM_DEV = 'http://localhost:5173';

// FRONTEND_URL aceita uma ou mais origens separadas por vírgula
// (ex: "https://sinapse.vercel.app,https://www.sinapse.com.br").
// Barra final removida porque o navegador nunca a envia no cabeçalho Origin.
function origensDeclaradas(): string[] {
  return (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

// Origens que recebem Access-Control-Allow-Origin.
export function origensPermitidasCors(): string[] {
  const origens = origensDeclaradas();
  if (process.env.NODE_ENV !== 'production' && !origens.includes(ORIGEM_DEV)) {
    origens.push(ORIGEM_DEV);
  }
  return origens;
}

// Base dos links enviados por e-mail: a primeira origem declarada.
export function urlFrontendPrincipal(): string {
  return origensDeclaradas()[0] ?? '';
}
