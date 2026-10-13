# Deploy — Sinapse Edu (backend)

Render (Web Service, Node) + Neon (PostgreSQL). Deploy a partir da branch `main`.

## 1. Render

| Campo | Valor |
|---|---|
| Branch | `main` |
| Build Command | `npm ci --include=dev && npx prisma generate && npm run build` |
| Start Command | `npm run start:prod` (executa `node dist/main`) |

- `--include=dev` é necessário: com `NODE_ENV=production`, o `npm ci` pula as
  devDependencies, e o build precisa do `@nestjs/cli` (`nest build`) e do
  `prisma` (CLI).
- O build **não** roda migrations; elas são aplicadas manualmente (passo 2).

## 2. Migrations no Neon

Rode da sua máquina, antes do primeiro deploy e sempre que houver migration
nova. A URL vai **só na linha de comando** — nunca salve a URL do Neon no `.env`.
Use a conexão **direta** (host sem `-pooler`) com `?sslmode=require`.

```bash
# Git Bash
DATABASE_URL="postgresql://USUARIO:SENHA@HOST/BANCO?sslmode=require" npx prisma migrate deploy
```

```powershell
# PowerShell
$env:DATABASE_URL="postgresql://USUARIO:SENHA@HOST/BANCO?sslmode=require"; npx prisma migrate deploy; Remove-Item Env:DATABASE_URL
```

Nunca use `prisma migrate dev`/`reset` contra o Neon.

## 3. Variáveis de ambiente no Render

Descrição de cada uma em `.env.example`.

| Variável | Obrigatória? |
|---|---|
| `DATABASE_URL` | Sim (o servidor não sobe sem ela em produção) |
| `JWT_SECRET` | Sim (o servidor não sobe sem ela) |
| `FRONTEND_URL` | Sim (o servidor não sobe sem ela em produção) — origem(ns) do frontend, separadas por vírgula |
| `NODE_ENV` | Sim — `production` |
| `PORT` | Não — o Render define sozinho |
| `SWAGGER_ENABLED` | Não — `true` liga o `/api/docs` (ex: dia da apresentação) |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Para enviar e-mails (ver observação abaixo) |
| `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY` | Não — sem nenhuma, os relatórios usam só a heurística |

> **Render gratuito bloqueia SMTP.** No plano free as conexões de saída SMTP
> são bloqueadas, então o **cadastro por e-mail** (verificação) e a
> **recuperação de senha** só funcionam depois do upgrade para uma instância
> paga. Até lá, use o usuário de demonstração (passo 4), que já nasce com
> e-mail verificado.

## 4. Dados de demonstração (`scripts/seed-demo.ts`)

Cria 1 usuário com e-mail já verificado, 2 aprendentes com nomes fictícios,
8 sessões concluídas para cada um (linha de base → intervenção, com
checklists), 1 molde de PEI e 3 tarefas.

- Só roda com `CONFIRMO_SEED=sim`; imprime o **host** do banco (nunca a URL)
  antes de gravar.
- E-mail e senha vêm de `SEED_EMAIL` e `SEED_SENHA` (sem valor fixo no código).
  A senha passa pela mesma regra de senha forte e pelo mesmo bcrypt do cadastro.
- Idempotente: se o e-mail já existe no banco, avisa e não grava nada.
- Rode **depois** do `prisma migrate deploy`, com a URL só na linha de comando:

```bash
# Git Bash
CONFIRMO_SEED=sim SEED_EMAIL="demo@exemplo.com" SEED_SENHA="..." \
DATABASE_URL="postgresql://USUARIO:SENHA@HOST/BANCO?sslmode=require" \
npx ts-node scripts/seed-demo.ts
```

```powershell
# PowerShell
$env:CONFIRMO_SEED="sim"; $env:SEED_EMAIL="demo@exemplo.com"; $env:SEED_SENHA="..."
$env:DATABASE_URL="postgresql://USUARIO:SENHA@HOST/BANCO?sslmode=require"
npx ts-node scripts/seed-demo.ts
Remove-Item Env:CONFIRMO_SEED, Env:SEED_EMAIL, Env:SEED_SENHA, Env:DATABASE_URL
```

O host é impresso logo antes da gravação, sem pausa para confirmar: revise a
`DATABASE_URL` do comando antes de rodar.
