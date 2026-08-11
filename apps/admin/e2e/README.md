# Testes E2E (Playwright)

Testes de ponta a ponta reais — sobem o painel de verdade num navegador
(Chromium) e batem num backend real rodando, sem mocks. Cobrem o caminho
crítico completo: login, criar evento, criar participante, ver/rotacionar
QR Code, revogar/reativar, importar CSV, criar terminal (código de
ativação), estatísticas.

## Como rodar

```bash
# 1. Backend rodando (num terminal separado)
npm run backend:dev --workspace=apps/backend
# (ou npm run backend:migrate + seed antes, se for a primeira vez —
#  ver docs/installation.md)

# 2. Painel apontando pro backend acima (outro terminal)
npm run dev --workspace=apps/admin

# 3. Testes (outro terminal)
npm run test:e2e --workspace=apps/admin
```

Por padrão os testes usam `admin@example.com` / `troque-esta-senha`
(mesmo default do seed do backend) e `http://localhost:5173`. Para
sobrescrever:

```bash
ADMIN_SEED_EMAIL=outro@email.com ADMIN_SEED_PASSWORD=outrasenha \
ADMIN_BASE_URL=http://localhost:4173 \
npm run test:e2e --workspace=apps/admin
```

## Por que isso importa

`tsc`/`vite build` só garantem que o código compila — não pegam bugs de
runtime como incompatibilidade de módulos (ex.: duas cópias de React
coexistindo num monorepo, causando "Invalid hook call" só quando o
componente de fato renderiza). Foi exatamente esse tipo de bug que esta
suíte encontrou e que motivou o `resolve.dedupe`/`alias` em
`vite.config.ts`. Rodar contra um backend real (não mocks) também expõe
incompatibilidades reais de contrato entre o painel e a API.
