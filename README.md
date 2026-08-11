# event-checkin — Sistema de Credenciamento e Controle de Presença

Sistema de credenciamento e controle de presença para congressos/eventos,
com terminais Android (Elgin M10 Pro / iMin D1) operando offline-first.

## Estado atual

- **Fase 0 (investigação do scanner): concluída e validada em hardware real.**
  Ver [`docs/scanner.md`](docs/scanner.md).
- **Fase 1 (backend): implementada, testada e documentada.**
  Ver [`docs/api.md`](docs/api.md), [`docs/architecture.md`](docs/architecture.md).
- **Fase 2 (app do terminal): implementada e validada no equipamento real**
  (ativação, check-in online, duplicidade, modo offline com sincronização
  automática). App React Native/Expo, câmera + ML Kit para leitura de QR.
- **Fase 3 (painel admin): implementada como aplicação web** (não
  desktop) — React + Vite, consome a mesma API do backend.
- **Fase 4 (deploy em produção): em andamento**, na VPS do cliente.

## Estrutura

```text
event-checkin/
├── apps/
│   ├── mobile/     # app do terminal (M10 Pro) — Expo/React Native
│   ├── backend/     # API REST — Fastify + Prisma + PostgreSQL
│   └── admin/        # painel administrativo — React + Vite (SPA web)
├── packages/          # código compartilhado (types, validation, config) — reservado
├── tools/
│   └── scanner-poc-android/  # PoC nativo Kotlin que validou a leitura de
│                              # QR Code via câmera no equipamento real
├── docs/               # ver índice abaixo
├── scripts/
│   └── install.sh       # instalação na VPS via Docker Compose
├── docker-compose.yml
└── .env.example
```

## Rodando localmente

Backend:

```bash
npm install
cp apps/backend/.env.example apps/backend/.env   # edite DATABASE_URL e JWT_SECRET
npm run backend:migrate
npm run seed --workspace=apps/backend             # cria o admin inicial
npm run backend:dev
```

Painel admin (aponta pro backend acima):

```bash
cp apps/admin/.env.example apps/admin/.env
npm install --workspace=apps/admin
npm run dev --workspace=apps/admin
```

Detalhes completos em [`docs/installation.md`](docs/installation.md).
Para deploy na VPS via Docker, ver [`docs/deployment.md`](docs/deployment.md).

## Testes

```bash
npm run backend:test
```

22 testes cobrindo: check-in válido/inválido/participante cancelado,
duplicidade, **concorrência real entre dois terminais** (só 1 check-in é
criado), sincronização offline, idempotência de reenvio, roster offline,
e o fluxo completo de ativação de terminal.

## Documentação

| Arquivo | Conteúdo |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Visão geral, módulos, decisões técnicas |
| [`docs/api.md`](docs/api.md) | Todos os endpoints, request/response |
| [`docs/database.md`](docs/database.md) | Schema, constraints, migrations, backup |
| [`docs/security.md`](docs/security.md) | Auth, senhas, QR token, dependências |
| [`docs/installation.md`](docs/installation.md) | Rodar localmente (dev) |
| [`docs/deployment.md`](docs/deployment.md) | Deploy na VPS (Docker) |
| [`docs/offline-sync.md`](docs/offline-sync.md) | Contrato de sincronização offline |
| [`docs/troubleshooting.md`](docs/troubleshooting.md) | Problemas comuns |
| [`docs/scanner.md`](docs/scanner.md) | Investigação do scanner (Fase 0) |
| [`docs/m10-pro.md`](docs/m10-pro.md) | Resumo operacional do equipamento |
| [`apps/mobile/README.md`](apps/mobile/README.md) | App do terminal — Fase 2 |
| [`apps/admin/README.md`](apps/admin/README.md) | Painel admin web — Fase 3 |
