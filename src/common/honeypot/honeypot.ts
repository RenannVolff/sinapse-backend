import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';

const logger = new Logger('Honeypot');

// Campo honeypot preenchido = bot. Loga só a rota (nunca o corpo da
// requisição) para não vazar dados enviados.
export function honeypotAcionado(
  valor: string | undefined,
  rota: string,
): boolean {
  if (!valor || valor.trim().length === 0) return false;
  logger.warn(`Requisição bloqueada por honeypot em ${rota}`);
  return true;
}

const PRENOMES = [
  'Ana',
  'Beatriz',
  'Camila',
  'Daniela',
  'Fernanda',
  'Juliana',
  'Larissa',
  'Mariana',
  'Patrícia',
  'Renata',
  'Bruno',
  'Carlos',
  'Eduardo',
  'Felipe',
  'Gustavo',
  'Henrique',
  'Lucas',
  'Marcelo',
  'Rafael',
  'Thiago',
];
const SOBRENOMES = [
  'Almeida',
  'Barbosa',
  'Cardoso',
  'Costa',
  'Ferreira',
  'Gomes',
  'Lima',
  'Martins',
  'Oliveira',
  'Pereira',
  'Ribeiro',
  'Rocha',
  'Santos',
  'Silva',
  'Souza',
];

// Nome plausível derivado do e-mail: o mesmo e-mail recebe sempre o mesmo
// nome, como aconteceria com uma conta real, e um bot que repita a tentativa
// não percebe diferença entre as respostas.
function nomeFalso(email: string): string {
  const hash = crypto.createHash('sha256').update(email.toLowerCase()).digest();
  return `${PRENOMES[hash[0] % PRENOMES.length]} ${SOBRENOMES[hash[1] % SOBRENOMES.length]}`;
}

// Resposta falsa com o mesmo formato do login real. O "token" tem cara de
// JWT, mas a assinatura é aleatória — o JwtAuthGuard rejeita qualquer uso.
export function loginFalso(email: string) {
  const parte = (bytes: number) =>
    crypto.randomBytes(bytes).toString('base64url');
  return {
    token: `${parte(27)}.${parte(60)}.${parte(32)}`,
    usuario: {
      id: crypto.randomUUID(),
      nome: nomeFalso(email),
      email,
      duploFatorAtivo: false,
    },
  };
}

// Resposta falsa com o mesmo formato do cadastro real (nada é gravado e
// nenhum e-mail é enviado).
export function cadastroFalso(nome: string, email: string) {
  return { id: crypto.randomUUID(), nome, email, criadoEm: new Date() };
}
