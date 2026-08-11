# Troubleshooting

## Backend não sobe: `listen EADDRINUSE`

Outra coisa já está usando a porta configurada em `PORT`. Mude `PORT` no
`.env` ou pare o processo que está ocupando a porta:

```bash
lsof -i :3000
```

## `Variáveis de ambiente inválidas` ao iniciar

`src/config/env.ts` valida o `.env` com Zod e recusa subir com
configuração incompleta — a mensagem de erro lista exatamente qual
variável está faltando ou é inválida (ex.: `JWT_SECRET` com menos de 16
caracteres). Confira contra `apps/backend/.env.example`.

## `P1001: Can't reach database server` (Prisma)

`DATABASE_URL` aponta para um Postgres que não está acessível. Verifique:
- O Postgres está rodando (`pg_isready`, ou `docker compose ps` se estiver
  usando o compose deste projeto).
- Host/porta/usuário/senha/nome do banco na `DATABASE_URL` batem com o
  que foi de fato criado.

## Testes falhando com erro de conexão ao banco

Os testes usam um banco **separado** do de desenvolvimento
(`event_checkin_test` por padrão — ver `tests/setup.ts`). Crie-o antes de
rodar a suíte:

```bash
psql -U seu_usuario -d postgres -c "CREATE DATABASE event_checkin_test;"
```

`tests/global-setup.ts` aplica as migrations nele automaticamente antes
da suíte — não é preciso rodar `prisma migrate` manualmente para o banco
de teste.

## Login retorna 401 mesmo com a senha certa

Confirme que o usuário foi criado (via `npm run seed` ou diretamente pela
API por outro admin). O backend nunca diferencia "e-mail não existe" de
"senha errada" na mensagem de erro (propositalmente, para não vazar quais
e-mails estão cadastrados) — então essa mensagem também aparece se o
e-mail simplesmente não tem cadastro.

## `POST /terminals/activate` retorna 401

Um destes três motivos, todos por design:
1. Código não existe (digitado errado).
2. Código já foi usado antes (um código de ativação é de uso único —
   `Terminal.status` deixa de ser `PENDING` depois da primeira ativação).
3. Código expirou (validade de 72h desde a criação do terminal).

Solução: criar um novo terminal (`POST /events/:eventId/terminals`) para
gerar um novo código — não há endpoint de "reenviar/regenerar código"
nesta fase (ver limitação em `api.md`).

## Check-in retorna `403 FORBIDDEN` mesmo com QR correto

O terminal usado pertence a um evento diferente do `:eventId` da URL, ou
o participante está com `status = CANCELLED`. O corpo da resposta
(`error.message`) diferencia os dois casos.

## Scanner do M10 Pro / iMin D1 não lê nada

Ver [`m10-pro.md`](m10-pro.md) e [`scanner.md`](scanner.md) — o
equipamento não tem leitura via sistema (HID/Intent), a decodificação
depende do app estar ativamente rodando a câmera. Se o app não estiver em
primeiro plano com a câmera ativa, não há leitura.
