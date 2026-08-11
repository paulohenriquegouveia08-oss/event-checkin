# Sincronização offline

Status: **contrato do backend implementado e testado** (`POST
/terminals/sync`). O lado do terminal (armazenamento local em SQLite,
fila de sincronização, detecção de conectividade) é Fase 2 — ainda não
implementado. Este documento descreve o contrato que a Fase 2 vai
consumir, já validado por `tests/synchronization.test.ts`.

## Contrato esperado do terminal

Enquanto offline, cada check-in deve ser guardado localmente com, no
mínimo:

```text
localCheckInId   — gerado no terminal, único *por terminal* (ex.: UUID)
eventId
participantId (ou o qrToken lido, para resolver o participante depois)
checkedInAt      — timestamp de quando a leitura aconteceu de fato, não de quando sincronizou
syncStatus       — pending | synced | rejected
```

Quando a conexão voltar, o terminal envia os pendentes em lote:

```http
POST /terminals/sync
Authorization: Bearer <token do terminal>

{
  "checkIns": [
    { "localCheckInId": "...", "qrToken": "...", "checkedInAt": "2026-09-01T10:00:00Z" }
  ]
}
```

## Como o backend resolve cada item do lote

Implementado em `checkins.service.ts#performCheckIn` (compartilhado com
o endpoint online) e `synchronization.service.ts#syncCheckIns`:

1. **Idempotência primeiro**: se já existe um `CheckIn` com esse
   `(terminalId, localCheckInId)`, devolve o resultado já conhecido sem
   revalidar nada — reenviar por causa de uma falha de rede no meio do
   caminho nunca duplica ou dá erro.
2. Resolve o participante pelo `qrToken`; se não existir, não pertencer a
   este evento, ou estiver revogado → item marcado `REJECTED`.
3. Se o participante estiver `CANCELLED` → `REJECTED`.
4. Tenta o `INSERT` do check-in. Duas coisas podem acontecer:
   - Sucesso → `CONFIRMED`.
   - Conflito na constraint `(eventId, participantId)` — alguém (outro
     terminal, online, ou este mesmo terminal antes de cair) já
     confirmou esse participante → `ALREADY_CHECKED_IN`, **não é
     tratado como erro**.
5. Um item `REJECTED` não interrompe o processamento dos demais itens do
   lote (`synchronization.service.ts` isola erro por item).

## Cenário de conflito entre dois terminais (seção 14 da especificação)

```text
Terminal A (offline) faz check-in local do participante X
Terminal B (online) confirma o participante X no backend
Terminal A reconecta e sincroniza
  → backend responde ALREADY_CHECKED_IN pra esse item
  → terminal A marca o registro local como sincronizado/resolvido,
    sem criar um segundo check-in
```

Coberto por
`tests/synchronization.test.ts > retorna ALREADY_CHECKED_IN quando outro
terminal já confirmou o mesmo participante online`.

## O que a Fase 2 (app mobile) ainda precisa decidir/implementar

- Biblioteca de banco local (SQLite via `expo-sqlite` ou equivalente).
- Estratégia de detecção de conectividade e disparo automático da sync.
- Tamanho de lote e retry/backoff quando `/terminals/sync` falhar por
  rede (o endpoint aceita até 500 itens por chamada — `synchronization.schema.ts`).
- UI de indicação de pendências não sincronizadas (seção 29 —
  observabilidade: "quantos offline, quantos sincronizados").
