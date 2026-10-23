// Fonte única dos limites de entrada usados nos DTOs (e espelhados no
// frontend). Mudou aqui, muda em todo o backend: nenhum DTO deve repetir um
// número solto. Regra geral: input comum de 30 a 50 caracteres; só textarea
// de escopo longo passa disso.
export const LIMITES = {
  // Pessoas e contato
  NOME_PESSOA: 50,
  EMAIL: 50,
  // Login/recuperação aceitam o máximo do padrão (RFC 5321) para nunca
  // trancar fora uma conta antiga; o cadastro novo é que fica em 50.
  EMAIL_LOGIN: 254,
  SENHA_MIN: 8,
  SENHA_MAX: 50,
  // O bcrypt só considera os primeiros 72 bytes; no login aceita até isso
  // para não barrar senhas antigas criadas antes do teto de 50.
  SENHA_LOGIN_MAX: 72,
  TELEFONE: 15,

  // Títulos e rótulos curtos
  TITULO: 50,
  ROTULO_CURTO: 30,

  // Áreas de texto
  TEXTO_CURTO: 300, // descrição, meta, nota de tarefa
  TEXTO_MEDIO: 1000, // observação, relato
  TEXTO_LONGO: 2000, // evolução, campos descritivos do PEI
  // Texto do relatório (IA/heurística) reenviado pelo front na exportação:
  // é gerado pelo próprio sistema e tem várias seções.
  TEXTO_RELATORIO: 20000,

  // Tokens/códigos técnicos (não digitados livremente pelo usuário)
  TOKEN: 200,
  TOKEN_JWT: 2000,
  CODIGO_2FA: 20,
  HONEYPOT: 500,

  // Numéricos
  DURACAO_MIN_MINUTOS: 1,
  DURACAO_MAX_MINUTOS: 1440,
  NIVEL_DIFICULDADE_MIN: 1,
  NIVEL_DIFICULDADE_MAX: 5,
  IDADE_MAX_ANOS: 120,
  ANO_MIN: 2000,
  ANO_MAX: 2100,
  // Faixa de datas de vigência (PEI) e de emissão de documentos
  DATA_MIN: '2000-01-01',
  DATA_MAX: '2100-12-31',
  PAGINA_MAX: 10000,
  POR_PAGINA_MAX: 100,

  // Listas
  GRAFICOS_EXPORTACAO_MAX: 10,
  // Imagem PNG em base64 de um gráfico (cabe no corpo de 15mb da rota)
  IMAGEM_BASE64_MAX: 4_000_000,
} as const;
