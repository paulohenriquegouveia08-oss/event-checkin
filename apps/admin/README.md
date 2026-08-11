# apps/admin — Painel administrativo (web)

SPA em React + TypeScript + Vite, consumindo a API do
[`apps/backend`](../backend). Fase 3 da especificação do produto,
implementada como aplicação web (não desktop) e hospedada na mesma VPS
do backend.

## Funcionalidades

- Login (JWT de admin).
- Eventos: criar, listar, mudar status (rascunho/ativo/encerrado).
- Participantes: criar, listar, revogar/reativar, gerar novo QR Code,
  importar em lote via CSV (com preview antes de confirmar).
- Terminais: criar (gera código de ativação de uso único) e listar
  status/último contato.
- Estatísticas do evento (inscritos, presentes, ausentes, % de presença,
  check-ins por terminal), atualizada automaticamente a cada 15s.

## Rodando localmente

```bash
cp .env.example .env   # ajuste VITE_API_URL se o backend não estiver em localhost:3900
npm install
npm run dev
```

## Build de produção

```bash
npm run build   # gera dist/ — assets estáticos, sem servidor Node necessário
```

`VITE_API_URL` é embutida no bundle em build-time (é uma SPA estática) —
mudar o backend de endereço exige rebuildar o painel, não só reiniciar.

## Testes E2E

```bash
npm run test:e2e
```

Testes reais em navegador (Playwright), contra um backend rodando de
verdade — ver [`e2e/README.md`](e2e/README.md). Validados tanto contra
`npm run dev` quanto contra o build de produção (`npm run build` +
`npm run preview`) antes de qualquer deploy.

## Limitações conhecidas

- Sem endpoint "quem sou eu" no backend: a sessão assume o token salvo
  como válido até a primeira chamada autenticada falhar (então redireciona
  pro login). Não há refresh token nesta fase.
- CORS do backend está aberto (`origin: true`) — a restringir para a
  origem real do painel quando houver domínio fixo.
- `vite.config.ts` fixa `resolve.dedupe`/`alias` para "react"/"react-dom"
  — necessário porque este é um monorepo com outro workspace (o app
  mobile, Expo) pinando uma versão exata de React diferente da instalada
  aqui, o que sem isso causa duas cópias de React coexistindo e erros de
  "Invalid hook call" em runtime (encontrado pelos testes E2E, não pelo
  typecheck). Ver comentário no arquivo.
