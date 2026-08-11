# Banco de dados

PostgreSQL, gerenciado via Prisma Migrate. Schema completo em
[`apps/backend/prisma/schema.prisma`](../apps/backend/prisma/schema.prisma).

## Modelo

```text
User            — administradores (login no painel)
Event           — congresso/evento
Participant     — inscrito de um evento, com QR token opaco
Terminal        — equipamento M10 Pro vinculado a um evento
CheckIn         — registro de presença
```

Relacionamentos: `Event 1—N Participant`, `Event 1—N Terminal`,
`Event 1—N CheckIn`, `Participant 1—N CheckIn` (mas limitado a no máximo
1 por evento pela constraint abaixo), `Terminal 1—N CheckIn`.

## Constraints que carregam regra de negócio

- `Participant.qrToken` — `@unique`. Garante que dois participantes nunca
  tenham o mesmo token (mesmo entre eventos diferentes).
- `CheckIn @@unique([eventId, participantId])` — a regra de "sem check-in
  duplicado" (seção 12 da especificação do produto) é aplicada pelo
  próprio Postgres, não só em código de aplicação. Ver
  [`architecture.md`](architecture.md#duplicidade-e-concorrência).
- `CheckIn @@unique([terminalId, localCheckInId])` — idempotência da
  sincronização offline: reenviar o mesmo registro local não duplica.
- `Terminal.identifier` e `Terminal.activationCode` — `@unique`.

## Campos sensíveis

- `User.passwordHash` — nunca é lido de volta por nenhum endpoint (os
  `select`/serializações da API não o incluem; testado em
  `tests/auth-terminals.test.ts`).
- `Terminal.credentialHash` — hash SHA-256 do token do terminal, nunca o
  token em claro.
- Nenhuma tabela armazena CPF/e-mail/telefone do participante *no QR* —
  esses campos ficam em `Participant`, mas o QR carrega só `qrToken`.

## Migrations

```bash
# desenvolvimento (cria e aplica uma nova migration a partir de mudanças no schema)
npm run migrate --workspace=apps/backend

# produção/deploy (aplica migrations já existentes, não gera novas)
npm run migrate:deploy --workspace=apps/backend
```

A primeira migration (`20260811003318_init`) cria todo o schema acima e
já foi aplicada e testada localmente (banco de dev `event_checkin_dev` e
banco de teste `event_checkin_test`, isolados de qualquer outro projeto
do monorepo PK Digital).

## Seed

`apps/backend/prisma/seed.ts` cria o primeiro usuário administrador, a
partir de `ADMIN_SEED_NAME` / `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`
no `.env`. Não faz nada (e não falha) se um usuário com esse e-mail já
existir.

```bash
npm run seed --workspace=apps/backend
```

## Backup e restore

Automatizado via `scripts/backup.sh` (dump comprimido + retenção
configurável, padrão 14 dias) e `scripts/restore.sh`:

```bash
# backup manual (também roda sozinho todo dia às 3h via cron na VPS)
./scripts/backup.sh
# gera $HOME/event-checkin-backups/event_checkin-<timestamp>.sql.gz

# restore (pede confirmação explícita — sobrescreve o banco atual)
./scripts/restore.sh $HOME/event-checkin-backups/event_checkin-20260811-142502.sql.gz
```

Cron configurado na VPS (`crontab -l` para conferir):

```cron
0 3 * * * cd $HOME/event-checkin && ./scripts/backup.sh >> $HOME/event-checkin-backups/backup.log 2>&1
```

Pendência conhecida: os backups ficam no mesmo disco da VPS — não há
cópia off-site ainda. Para maior segurança, sincronizar
`$HOME/event-checkin-backups/` periodicamente para um storage externo
(S3, Backblaze, etc.).
