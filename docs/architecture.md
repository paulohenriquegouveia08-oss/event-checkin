# Arquitetura

## Visão geral

```text
                 ┌────────────────────────┐
                 │      ADMINISTRADOR      │
                 │  (painel — Fase 3,      │
                 │   ainda não iniciado)   │
                 └───────────┬─────────────┘
                             │ HTTPS (JWT admin)
                             ▼
                 ┌────────────────────────┐
                 │        BACKEND          │   apps/backend/
                 │  Fastify + TypeScript   │   Fase 1 — implementado
                 │  PostgreSQL + Prisma    │
                 └───────────┬─────────────┘
                             │
                ┌────────────┴─────────────┐
                │                           │
                ▼                           ▼
       ┌─────────────────┐        ┌──────────────────────┐
       │  PARTICIPANTE    │        │   TERMINAL (M10 Pro)  │
       │  QR Code (token  │        │  apps/mobile/          │
       │  opaco, sem PII) │        │  Fase 2 — não iniciado │
       └─────────────────┘        │  JWT terminal + SQLite│
                                    └──────────────────────┘
```

## Por que Fastify + Prisma + PostgreSQL

- **Fastify**: performance e baixo overhead são relevantes aqui — o
  endpoint de check-in precisa responder em poucos segundos por pessoa em
  picos de fila (seção 23/42 da especificação do produto). Schema
  validation nativo via plugins, ecossistema maduro de plugins oficiais
  (`@fastify/jwt`, `@fastify/rate-limit`, `@fastify/helmet`, `@fastify/cors`)
  cobre autenticação, rate limit e headers de segurança sem reinventar nada.
- **Prisma**: migrations versionadas e reproduzíveis (`prisma/migrations/`),
  types gerados a partir do schema (elimina uma classe inteira de bugs de
  dessincronia entre banco e código), e a constraint `@@unique` do schema é
  a peça central que garante não-duplicidade de check-in mesmo sob
  concorrência real (ver "Duplicidade e concorrência" abaixo).
- **PostgreSQL**: exigido pela especificação do produto; adequado ao
  volume esperado (milhares de participantes, centenas de check-ins em
  poucos minutos — seção 42).

## Módulos do backend

```text
apps/backend/src/
├── app.ts              # monta a instância Fastify e registra tudo
├── server.ts            # entrypoint (listen + shutdown gracioso)
├── config/env.ts         # validação de variáveis de ambiente (Zod)
├── database/prisma.ts    # instância única do Prisma Client
├── middleware/
│   ├── auth.ts           # requireAdmin / requireTerminal
│   └── error-handler.ts  # AppError/ZodError -> resposta HTTP padronizada
├── shared/
│   ├── errors.ts          # AppError e subclasses (NotFound, Forbidden, ...)
│   ├── response.ts        # envelope { success, data } / { success, error }
│   ├── tokens.ts           # geração de QR token, código de ativação, hash
│   └── passwords.ts        # hash/verificação de senha (bcryptjs)
└── modules/
    ├── auth/            # login do admin
    ├── users/            # (reservado — hoje só o seed cria o admin)
    ├── events/           # CRUD de eventos
    ├── participants/     # CRUD, importação CSV, rotação de QR token
    ├── terminals/         # criação e ativação de terminal
    ├── checkins/          # check-in online + estatísticas
    └── synchronization/   # sincronização em lote do terminal offline
```

Cada módulo segue `schema` (validação Zod) → `repository` (acesso ao
Prisma) → `service` (regra de negócio) → `routes` (handlers HTTP), na
medida em que isso agregava clareza — módulos pequenos (ex.: `users`)
não foram fragmentados artificialmente.

## Duplicidade e concorrência

A regra "um participante não pode ser credenciado duas vezes no mesmo
evento" **não é aplicada em memória ou só na camada de serviço** — ela é
uma constraint do banco:

```prisma
@@unique([eventId, participantId])
```

`checkins.service.ts#performCheckIn` tenta o `INSERT`; se ele falhar por
violação dessa constraint (código `P2002` do Prisma), o código busca o
check-in já existente e devolve `ALREADY_CHECKED_IN` em vez de propagar um
erro. Isso funciona corretamente mesmo quando dois terminais diferentes
enviam a mesma requisição no mesmo instante — o Postgres garante que só um
`INSERT` vence, não importa a ordem de chegada na aplicação. Testado em
`tests/checkins.test.ts` com duas requisições disparadas em paralelo
(`Promise.all`).

## Isolamento de dados / preparação para multi-tenancy

O MVP não tem uma tabela `Organization`. `Event` já funciona como a
fronteira de isolamento: participantes, terminais e check-ins sempre
pertencem a um `eventId`, e todo endpoint de terminal valida que o token
apresentado pertence ao evento do path (`request.terminal.eventId ===
eventId`). Adicionar `Organization` no futuro é uma migration aditiva
(`organizationId` nullable em `Event`/`User`), sem quebrar o que existe.

## Autenticação — dois tipos de credencial

| | Admin | Terminal |
|---|---|---|
| Como se autentica | e-mail + senha (`POST /auth/login`) | código de ativação de uso único (`POST /terminals/activate`) |
| Formato do token | JWT, expira em `JWT_ADMIN_EXPIRES_IN` (padrão 8h) | JWT, expira em 365 dias |
| Revogação | expiração natural do token | mudar `Terminal.status` para `INACTIVE`, ou reativar (gera novo token, invalida o hash antigo) |

Detalhes completos em [`security.md`](security.md).

## Painel admin — web, não desktop

A especificação original do produto (seção 19) oferecia Electron/Tauri
como opção para o painel administrativo. Decisão do cliente: o painel é
uma SPA web (React + Vite, `apps/admin/`), hospedada na mesma VPS do
backend, sem necessidade de instalar nada localmente para administrar
eventos — só um navegador. Isso simplifica atualização (redeploy do
container substitui a versão pra todo mundo, sem reinstalar em cada
máquina de admin) às custas de exigir acesso à VPS para uso offline do
painel (aceitável — diferente do terminal do M10 Pro, o painel não
precisa funcionar sem internet).

## O que ainda não existe

- Importação apenas em CSV — XLSX mencionado na especificação do produto
  como "se possível" não foi implementado, para não adicionar a
  dependência `xlsx` sem uso comprovado ainda (YAGNI).
- HTTPS em produção (ver limitação em `docs/deployment.md`) — o painel e
  o app do terminal falam com o backend em HTTP puro por enquanto.
