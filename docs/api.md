# API — Backend (Fase 1)

Base URL: `http://<host>:<PORT>` (padrão `PORT=3000`).

Todas as respostas usam o envelope:

```json
// sucesso
{ "success": true, "data": { ... } }

// erro
{ "success": false, "error": { "code": "STRING_CODE", "message": "...", "details": null } }
```

Autenticação via header `Authorization: Bearer <token>`. Existem dois
tipos de token — veja [`security.md`](security.md) para o fluxo completo.

## Health check

### `GET /health`
Sem autenticação.

```json
{ "success": true, "data": { "status": "ok", "apiVersion": "0.1.0" } }
```

## Auth (admin)

### `POST /auth/login`
Body: `{ "email": string, "password": string }`
Resposta: `{ token, user: { id, name, email, role } }`

## Eventos (requer token de admin)

| Método | Path | Descrição |
|---|---|---|
| POST | `/events` | Cria evento. Body: `name, description?, location?, startDate, endDate` |
| GET | `/events` | Lista todos os eventos |
| GET | `/events/:eventId` | Detalhe de um evento |
| PATCH | `/events/:eventId` | Atualiza campos do evento, incl. `status` (`DRAFT`\|`ACTIVE`\|`CLOSED`) |

## Participantes (requer token de admin)

| Método | Path | Descrição |
|---|---|---|
| POST | `/events/:eventId/participants` | Cria participante. Body: `name, email?, phone?, document?` |
| GET | `/events/:eventId/participants` | Lista participantes do evento |
| PATCH | `/events/:eventId/participants/:participantId` | Atualiza dados/status (`ACTIVE`\|`CANCELLED`) |
| POST | `/events/:eventId/participants/:participantId/rotate-qr-token` | Revoga o QR atual e gera um novo |
| DELETE | `/events/:eventId/participants/:participantId` | Exclui o participante (204). Diferente de excluir terminal, aqui o histórico de check-ins dele é apagado junto (cascade) — não tem como preservar, o dono do registro deixou de existir |
| POST | `/events/:eventId/participants/import` | Importação em lote via CSV (ver abaixo) |

### Importação CSV

Colunas esperadas (cabeçalho, case-insensitive): `nome,email,telefone,documento`.

Body: `{ "csv": "<conteúdo do arquivo>", "confirm": boolean }`

- `confirm: false` (ou omitido) → **modo preview**: valida, normaliza e
  detecta duplicados (dentro do próprio arquivo e contra participantes já
  existentes no evento), mas **não grava nada**. Devolve o relatório linha
  a linha.
- `confirm: true` → grava as linhas válidas e não-duplicadas, e devolve o
  mesmo relatório mais `imported: <quantidade gravada>`.

```json
{
  "success": true,
  "data": {
    "totalRows": 3,
    "validCount": 2,
    "invalidCount": 0,
    "duplicateCount": 1,
    "imported": 2,
    "rows": [
      { "row": 2, "name": "João", "email": "joao@email.com", "status": "valid" },
      { "row": 3, "name": "Maria", "email": "maria@email.com", "status": "valid" },
      { "row": 4, "name": "João", "email": "joao@email.com", "status": "duplicate", "reason": "Duplicado dentro do próprio arquivo" }
    ]
  }
}
```

## Terminais

| Método | Path | Auth | Descrição |
|---|---|---|---|
| POST | `/events/:eventId/terminals` | admin | Cria terminal, retorna `activationCode` (formato `XXXX-XXXX`, expira em 72h) |
| GET | `/events/:eventId/terminals` | admin | Lista terminais do evento |
| GET | `/terminals/:terminalId/status` | admin | Status/último `lastSeenAt` de um terminal |
| DELETE | `/events/:eventId/terminals/:terminalId` | admin | Exclui o terminal (204). Histórico de check-ins é preservado (`terminalId` vira `null`); qualquer requisição futura do aparelho excluído recebe 401 — o app do terminal detecta isso e se desconecta sozinho |
| POST | `/terminals/activate` | nenhuma (o código é a credencial) | Body: `{ activationCode }`. Retorna `{ token, terminal, event }` |

## Check-in (requer token de terminal)

### `POST /events/:eventId/checkins`
Body: `{ "qrToken": string }`

Respostas possíveis (todas HTTP 2xx — são desfechos de negócio válidos,
não erros):

```json
// 201 — primeira confirmação
{ "success": true, "data": { "status": "CONFIRMED", "participant": { "id": "...", "name": "..." }, "checkedInAt": "..." } }

// 200 — já tinha sido confirmado antes (por este ou outro terminal)
{ "success": true, "data": { "status": "ALREADY_CHECKED_IN", "participant": { "id": "...", "name": "..." }, "checkedInAt": "..." } }
```

Erros (HTTP 4xx, rejeições de fato):

| HTTP | `error.code` | Quando |
|---|---|---|
| 404 | `NOT_FOUND` | QR token não existe, não pertence a este evento, ou foi revogado |
| 403 | `FORBIDDEN` | Participante com status `CANCELLED` |

### `GET /events/:eventId/statistics`
Auth: admin.

```json
{
  "success": true,
  "data": {
    "totalRegistered": 2500,
    "totalCheckedIn": 1873,
    "totalAbsent": 627,
    "attendancePercentage": 74.92,
    "checkInsByTerminal": [{ "terminalId": "...", "count": 812 }]
  }
}
```

## Sincronização offline (requer token de terminal)

### `GET /terminals/sync/participants`
Retorna o roster completo do evento do terminal (id, nome, qrToken, status,
updatedAt) para cache local (SQLite) — permite validar leituras offline
sem contato com o backend. Chamado na ativação e periodicamente enquanto
online.

```json
{
  "success": true,
  "data": {
    "event": { "id": "...", "name": "...", "status": "ACTIVE" },
    "participants": [
      { "id": "...", "name": "João da Silva", "qrToken": "evt_...", "status": "ACTIVE", "updatedAt": "..." }
    ]
  }
}
```

### `POST /terminals/sync`
Body: `{ "checkIns": [{ "localCheckInId": string, "qrToken": string, "checkedInAt": ISO8601 }, ...] }` (máx. 500 itens por lote)

Processa cada item de forma independente — um item rejeitado não aborta o
lote. Resposta:

```json
{
  "success": true,
  "data": {
    "results": [
      { "localCheckInId": "local-001", "status": "CONFIRMED", "participant": {...}, "checkedInAt": "..." },
      { "localCheckInId": "local-002", "status": "ALREADY_CHECKED_IN", "participant": {...}, "checkedInAt": "..." },
      { "localCheckInId": "local-003", "status": "REJECTED", "code": "NOT_FOUND", "message": "Credencial inválida" }
    ]
  }
}
```

Reenviar o mesmo `localCheckInId` é idempotente: o backend identifica que
aquele registro específico já foi sincronizado por aquele terminal e
devolve o mesmo resultado, sem duplicar.

## Limitações conhecidas desta fase

- Não há endpoint para o admin recuperar/regenerar o `activationCode` de
  um terminal já criado — se perdido antes da ativação, é preciso criar
  um novo terminal.
- Rate limit é global (100 req/min por IP, `@fastify/rate-limit`), não
  diferenciado por endpoint.
