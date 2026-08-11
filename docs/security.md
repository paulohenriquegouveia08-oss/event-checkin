# Segurança

## Senhas

`bcryptjs` (implementação pura em JavaScript do bcrypt, 12 salt rounds).
Escolhida em vez de `argon2`/`bcrypt` nativos especificamente para não
depender de compilação de módulo nativo — nem no ambiente de
desenvolvimento (evita exigir toolchain de build de quem for rodar o
projeto), nem na imagem Docker de produção (evita que uma imagem base
diferente ou uma atualização do Node quebre o build por incompatibilidade
de binário nativo). Trade-off aceito conscientemente: bcrypt é mais lento
que argon2id para o mesmo nível de segurança, mas nenhum dos dois é gargalo
aqui (login de admin é uma operação de baixa frequência).

## Autenticação — dois tipos de token, ambos JWT (`@fastify/jwt`)

### Admin
`POST /auth/login` → JWT contendo `{ sub: userId, role, type: "admin" }`,
expira em `JWT_ADMIN_EXPIRES_IN` (padrão 8h). Sem refresh token nesta
fase — expirado, o admin loga de novo.

### Terminal
Fluxo de ativação (seção 17 da especificação do produto):

1. Admin cria o terminal (`POST /events/:eventId/terminals`) → backend
   gera um código de ativação de 8 caracteres (`XXXX-XXXX`, alfabeto sem
   caracteres ambíguos — sem `0/O`, `1/I/L`), com validade de 72h.
2. Operador digita o código no equipamento → `POST /terminals/activate`.
3. Backend valida o código (existe, não expirou, ainda não foi usado —
   status `PENDING`), emite um JWT de terminal (`{ sub: terminalId,
   eventId, type: "terminal" }`, validade de 365 dias) e grava o **hash
   SHA-256** desse token em `Terminal.credentialHash`. O token em claro só
   existe na resposta HTTP dessa chamada — nunca mais é recuperável pelo
   backend.
4. O terminal guarda o token localmente e o usa como `Authorization:
   Bearer` em todas as chamadas seguintes.

**Por que o token do terminal dura 365 dias em vez de expirar em horas:**
o equipamento fica em uso contínuo durante todo o ciclo de vida do evento,
sem um humano para refazer login. Expiração curta forçaria reativação
manual no meio de um congresso.

**Credencial rotacionável (seção 18):** revogar um terminal não depende
de esperar o JWT expirar. `middleware/auth.ts#requireTerminal` verifica,
a cada requisição, que (a) o terminal ainda está com `status = ACTIVE` e
(b) o hash do token apresentado bate com `Terminal.credentialHash`
salvo no banco. Mudar o `status` para `INACTIVE` (ou reativar o terminal,
o que gera um novo token e sobrescreve o hash) invalida imediatamente
qualquer token anterior, mesmo que ele ainda não tenha expirado.

## QR Code — sem dados pessoais (seção 9)

`Participant.qrToken` é gerado com `crypto.randomBytes(24)` (192 bits de
entropia), formato `evt_<base64url>`. Não é derivado de nome, e-mail, CPF
ou telefone — é um identificador opaco sem significado fora do banco.
Revogável e regenerável via `POST
/events/:eventId/participants/:participantId/rotate-qr-token` (o token
antigo para de existir — a coluna é `@unique`, então o novo valor
substitui o antigo na mesma linha, e uma busca pelo token antigo
simplesmente não encontra nada).

## Validação de entrada

Todo body/params de toda rota passa por um schema Zod antes de tocar
qualquer lógica de negócio (`*.schema.ts` em cada módulo). Falha de
validação vira `422 VALIDATION_ERROR` com o detalhamento por campo
(`error.flatten()` do Zod) — nunca deixa dado não validado chegar ao
Prisma.

## Erros — nunca vaza stack trace

`middleware/error-handler.ts` centraliza todo tratamento de erro. Erros
de domínio (`AppError` e subclasses) viram respostas HTTP previsíveis;
qualquer erro não esperado vira `500 INTERNAL_ERROR` genérico — o cliente
nunca recebe stack trace, nome de arquivo ou detalhe de implementação.

## Logs

Logger estruturado (`pino`, embutido no Fastify). O header
`Authorization` é redigido nos logs (`redact: ["req.headers.authorization"]`
em `app.ts`) — tokens nunca aparecem em log. Senha em claro nunca passa
perto de nenhuma chamada de log (só o hash é persistido; o valor em claro
existe apenas durante a requisição, na memória).

## Rede

- `@fastify/helmet` — headers de segurança padrão.
- `@fastify/cors` — habilitado (`origin: true`); a ser restringido a
  origens conhecidas quando o painel admin (Fase 3) tiver um domínio fixo.
- `@fastify/rate-limit` — 100 requisições/minuto por IP, global. Não
  diferenciado por endpoint nesta fase (ex.: `/auth/login` poderia ter um
  limite mais agressivo especificamente contra força bruta — não
  implementado ainda).
- HTTPS é responsabilidade da camada de proxy/reverse-proxy na VPS (não
  configurada nesta fase — ver limitação em `deployment.md`).

## Dependências — vulnerabilidades conhecidas

`npm audit` rodado e zerado nesta entrega (0 vulnerabilidades). Duas
correções relevantes durante o desenvolvimento:
- `@fastify/jwt` estava pinado numa versão que dependia de uma versão do
  `fast-jwt` com uma CVE **crítica** (bypass de autenticação via segredo
  HMAC vazio). Atualizado para `@fastify/jwt@^10` (que usa uma versão
  corrigida do `fast-jwt`) antes de qualquer código de autenticação ser
  escrito sobre ele.
- `vitest` atualizado para `^4` para eliminar uma vulnerabilidade crítica
  na cadeia `vite`/`esbuild` usada pela sua UI de desenvolvimento (não
  afeta o código de produção, mas é boa prática não deixar CVE crítica
  sem correção mesmo em dev-dependency).

## O que ainda não foi implementado (pendências de segurança conhecidas)

- Rate limit específico para `/auth/login` (força bruta).
- Refresh token / logout explícito para sessão de admin.
- HTTPS/TLS (delegado ao reverse proxy da VPS, não incluído neste
  docker-compose).
- Auditoria formal (quem alterou o quê) além dos logs estruturados padrão.
