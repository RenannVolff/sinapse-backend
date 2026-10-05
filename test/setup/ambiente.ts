import { resolverBancoTeste } from './banco-teste';

// Roda em cada worker do Jest ANTES de qualquer import do app (setupFiles).
// Variáveis já presentes em process.env não são sobrescritas pelo .env
// (nem pelo ConfigModule, nem pelo Prisma), então o que é definido aqui vence.

const { url } = resolverBancoTeste();

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = url;

// Segredo próprio da suíte: tokens de teste nunca valem no ambiente real.
process.env.JWT_SECRET = 'segredo-exclusivo-da-suite-e2e-nao-usar-em-producao';

// Serviços externos desligados. Strings vazias (e não `delete`) para o .env
// não preencher as chaves: sem nenhuma chave de IA o relatório cai na
// heurística, e sem credenciais SMTP o EmailService real não teria
// transporte (de todo modo, ele é substituído por um falso nos testes).
process.env.GEMINI_API_KEY = '';
process.env.GROQ_API_KEY = '';
process.env.OPENROUTER_API_KEY = '';
process.env.GMAIL_USER = '';
process.env.GMAIL_APP_PASSWORD = '';
process.env.FRONTEND_URL = 'http://localhost-e2e.invalid';
