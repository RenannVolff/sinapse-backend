import { Prisma } from '@prisma/client';

// Ordenação de listagens feita no banco. O Prisma não aceita collation no
// orderBy, e o collation padrão do banco varia (no Neon é C.UTF-8, que põe
// "Bruno" antes de "alice" e "Álvaro" depois de "Zé"). Por isso as listagens
// que ordenam texto usam $queryRaw com o collation ICU explícito abaixo.
//
// Segurança: nenhum trecho do SQL de ordenação vem do usuário. O DTO só aceita
// valores de uma whitelist, e cada valor aponta para um fragmento FIXO
// (Prisma.raw de constante). Valores de filtro seguem como parâmetros.

export const DIRECOES_ORDENACAO = ['asc', 'desc'] as const;
export type DirecaoOrdenacao = (typeof DIRECOES_ORDENACAO)[number];

// Collation ICU raiz (CLDR): ignora maiúsculas/minúsculas e acentos no
// primeiro nível ("Álvaro" fica junto dos "A"), com a mesma ordem do pt-BR.
// Existe em todo Postgres compilado com ICU (padrão no Neon, Docker e Windows).
// `coluna` é sempre uma constante do código, nunca input do usuário.
export function textoOrdenavel(coluna: string): Prisma.Sql {
  return Prisma.raw(`"${coluna}" COLLATE "und-x-icu"`);
}

export function sqlDirecao(direcao: DirecaoOrdenacao | undefined): Prisma.Sql {
  return Prisma.raw(direcao === 'desc' ? 'DESC' : 'ASC');
}
