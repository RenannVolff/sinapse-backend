// Limpeza de texto livre contra XSS armazenado: remove blocos de
// script/style inteiros e qualquer tag HTML, e apara as pontas. Só mexe no
// que parece tag (`<` seguido de letra, `/` ou `!`), então textos clínicos
// como "acertos < 5" ou "3 > 2" passam intactos.
const REGEX_BLOCO_PERIGOSO =
  /<\s*(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi;
const REGEX_TAG = /<\s*[a-zA-Z/!][^>]*>/g;

export function sanitizarTexto(valor: unknown): unknown {
  if (typeof valor !== 'string') return valor;
  return valor.replace(REGEX_BLOCO_PERIGOSO, '').replace(REGEX_TAG, '').trim();
}

// Nome de pessoa: além da limpeza, colapsa espaços repetidos internos.
export function sanitizarNome(valor: unknown): unknown {
  const limpo = sanitizarTexto(valor);
  return typeof limpo === 'string' ? limpo.replace(/\s+/g, ' ') : limpo;
}
