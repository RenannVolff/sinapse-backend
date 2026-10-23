import { promises as dns } from 'dns';
import { registerDecorator, ValidationArguments } from 'class-validator';

// Checagem "barata" de e-mail real no cadastro. A confirmação definitiva
// continua sendo o link de verificação enviado por e-mail.

// Lista local e pequena de provedores de e-mail temporário mais comuns.
const DOMINIOS_DESCARTAVEIS = new Set([
  '10minutemail.com',
  '10minutemail.net',
  'burnermail.io',
  'dispostable.com',
  'emailondeck.com',
  'fakeinbox.com',
  'getnada.com',
  'guerrillamail.com',
  'guerrillamail.info',
  'guerrillamail.net',
  'mailinator.com',
  'maildrop.cc',
  'minuteinbox.com',
  'mintemail.com',
  'mohmal.com',
  'sharklasers.com',
  'tempail.com',
  'temp-mail.org',
  'tempmail.com',
  'tempmailo.com',
  'throwawaymail.com',
  'trashmail.com',
  'yopmail.com',
]);

// Erros de digitação frequentes nos provedores mais usados no Brasil.
const CORRECOES_DOMINIO: Record<string, string> = {
  'gmial.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gnail.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.com.br': 'gmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com',
  'hotmail.con': 'hotmail.com',
  'hotmil.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlook.co': 'outlook.com',
  'outlook.con': 'outlook.com',
  'yaho.com': 'yahoo.com',
  'yahoo.co': 'yahoo.com',
  'yahoo.con': 'yahoo.com',
  'yahoo.com.b': 'yahoo.com.br',
  'yaho.com.br': 'yahoo.com.br',
  'iclod.com': 'icloud.com',
  'icloud.co': 'icloud.com',
};

const TIMEOUT_DNS_MS = 3000;

type ResultadoDns = 'existe' | 'inexistente' | 'indeterminado';

function comTimeout<T>(promessa: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const estouro = new Promise<T>((_, rejeitar) => {
    timer = setTimeout(
      () => rejeitar(Object.assign(new Error('timeout'), { code: 'ETIMEOUT' })),
      TIMEOUT_DNS_MS,
    );
  });
  return Promise.race([promessa, estouro]).finally(() => clearTimeout(timer));
}

// Só conclui "inexistente" com resposta definitiva do DNS (domínio não
// existe, ou existe sem MX e sem endereço). Timeout, servidor fora do ar ou
// qualquer outra falha = indeterminado, e o cadastro segue.
async function verificarDominio(dominio: string): Promise<ResultadoDns> {
  try {
    const mx = await comTimeout(dns.resolveMx(dominio));
    return mx.length > 0 ? 'existe' : 'inexistente';
  } catch (erro) {
    const codigo = (erro as { code?: string }).code;
    if (codigo === 'ENOTFOUND') return 'inexistente';
    if (codigo !== 'ENODATA') return 'indeterminado';
  }

  // Sem MX, a RFC 5321 manda entregar no registro A/AAAA do próprio domínio.
  try {
    const enderecos = await comTimeout(dns.resolve(dominio));
    return enderecos.length > 0 ? 'existe' : 'inexistente';
  } catch (erro) {
    const codigo = (erro as { code?: string }).code;
    return codigo === 'ENOTFOUND' || codigo === 'ENODATA'
      ? 'inexistente'
      : 'indeterminado';
  }
}

function verificacaoDnsLigada(): boolean {
  // A suíte e2e desliga (domínios de teste não existem e não há rede garantida)
  return process.env.VALIDAR_DNS_EMAIL !== 'false';
}

export function EmailReal() {
  return function (object: object, propertyName: string) {
    // Mensagem calculada na validação (depende do motivo da recusa)
    const motivos = new WeakMap<object, string>();

    registerDecorator({
      name: 'emailReal',
      target: object.constructor,
      propertyName,
      async: true,
      validator: {
        async validate(valor: unknown, args: ValidationArguments) {
          if (typeof valor !== 'string' || !valor.includes('@')) return true; // @IsEmail cuida
          const [local, dominio] = valor.split('@');

          const correcao = CORRECOES_DOMINIO[dominio];
          if (correcao) {
            motivos.set(
              args.object,
              `E-mail: o domínio parece ter um erro de digitação. Você quis dizer ${local}@${correcao}?`,
            );
            return false;
          }

          if (DOMINIOS_DESCARTAVEIS.has(dominio)) {
            motivos.set(
              args.object,
              'E-mail: endereços de e-mail temporário não são aceitos. Use um e-mail pessoal ou profissional.',
            );
            return false;
          }

          if (
            verificacaoDnsLigada() &&
            (await verificarDominio(dominio)) === 'inexistente'
          ) {
            motivos.set(
              args.object,
              `E-mail: o domínio "${dominio}" não recebe e-mails. Confira se foi digitado corretamente.`,
            );
            return false;
          }

          return true;
        },
        defaultMessage(args: ValidationArguments): string {
          return (
            motivos.get(args.object) ?? 'E-mail: informe um e-mail válido.'
          );
        },
      },
    });
  };
}
