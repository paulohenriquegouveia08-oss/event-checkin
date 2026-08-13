# Deploy na VPS

**Status: implantado e validado em produção real** (Oracle Cloud, Ubuntu
24.04) — não é mais teoria. Detalhes do ambiente real e dos problemas
encontrados/corrigidos no processo estão registrados abaixo, porque essa
VPS hospeda **outros projetos do cliente simultaneamente** — qualquer
deploy futuro (deste projeto ou de outro) precisa levar isso em conta.

## Pré-requisitos na VPS

- Docker + Docker Compose plugin v2 (`docker compose version` deve funcionar)
- Nenhum Node.js, PostgreSQL ou outra dependência instalada no host —
  tudo roda em container.

## Passos

```bash
git clone <repositório> event-checkin   # ou rsync, se ainda não há remoto git
cd event-checkin
cp .env.example .env
# edite .env: POSTGRES_PASSWORD, JWT_SECRET (openssl rand -hex 32),
# ADMIN_SEED_EMAIL/PASSWORD, PUBLIC_API_URL, PORT, ADMIN_PORT
./scripts/install.sh
```

**Atenção com valores que têm espaço no `.env`** — o `install.sh` faz
`source .env` como script bash; um valor como
`ADMIN_SEED_NAME=Administrador PK Digital` sem aspas quebra o script
(`PK: command not found`). Use `ADMIN_SEED_NAME="Administrador PK Digital"`.

O `install.sh`:
1. Verifica se `docker` e `docker compose` estão disponíveis.
2. Garante que existe um `.env` (copia de `.env.example` se faltar) e
   recusa continuar se `JWT_SECRET`/`PUBLIC_API_URL` ainda estiverem com
   valor de exemplo.
3. Builda as imagens e sobe os containers (`docker compose up -d --build`).
4. Aguarda o `/health` responder.
5. Roda o seed do usuário administrador inicial (idempotente — não
   duplica se já existir).
6. Confirma o health check uma última vez.

## O que o `docker-compose.yml` sobe

```text
db        — postgres:16-alpine, sem porta exposta ao host (só rede interna docker)
migrate   — roda "prisma migrate deploy" e sai; backend só sobe depois
            deste terminar com sucesso (depends_on: service_completed_successfully)
backend   — API Fastify, porta ${PORT}
admin     — painel web (Nginx servindo build estático), porta ${ADMIN_PORT}
```

Uso de recursos real observado (VPS com outros ~15 containers de outros
projetos rodando simultaneamente): **~90MB de RAM no total** para os 3
containers deste projeto — leve o suficiente pra conviver tranquilamente
num host compartilhado.

## Escolhendo `PORT` e `ADMIN_PORT` numa VPS compartilhada

Se a VPS já hospeda outros projetos, **não assuma que as portas padrão
(3000/8080) estão livres**. Antes de definir `PORT`/`ADMIN_PORT` no
`.env`:

```bash
sudo ss -tlnp   # lista todas as portas já em uso no host
```

Isso não é só sobre a porta estar livre no host — numa VPS de provedor
cloud (Oracle Cloud, AWS, etc.) existem **duas camadas de firewall**:

1. **Firewall do SO** (iptables/ufw) — controla o próprio Linux.
2. **Security List / Network Security Group da nuvem** — controla o
   tráfego antes mesmo de chegar à interface de rede da VM. Uma porta
   pode estar liberada no iptables e ainda assim ser inacessível de fora
   se não estiver liberada aqui também.

Only portas que já têm regra de ACCEPT no iptables **e** estão liberadas
na Security List da nuvem funcionam de fora. Na prática, se a VPS já tem
um bloco de portas pré-liberado na Security List (comum quando o mesmo
provedor já hospeda vários projetos — verifique com
`sudo iptables -L INPUT -n --line-numbers`, procurando por portas com
regra `ACCEPT` mas **sem** nenhum processo `LISTEN` nelas em `ss -tlnp` —
essas são "vagas" reservadas e prontas pra uso), prefira reaproveitar uma
dessas em vez de abrir uma porta nova — abrir uma porta nova na Security
List exige acesso ao console web do provedor (fora do alcance de SSH),
enquanto reaproveitar uma porta já liberada não exige nada além de editar
o `.env`.

## Atualizando uma instalação existente

```bash
git pull   # ou rsync do código atualizado
docker compose up -d --build
```

O serviço `migrate` roda de novo automaticamente antes do `backend`
subir, aplicando qualquer migration nova.

## Backup / restore

Ver [`database.md`](database.md#backup-e-restore).

## Problemas reais encontrados no primeiro deploy (e já corrigidos)

Registrado aqui porque são armadilhas comuns de Prisma + Docker, não
específicas deste projeto — úteis se o `Dockerfile` for usado de
referência em outro lugar:

1. **Ordem errada: `tsc` build antes de `prisma generate`.** O código
   importa tipos gerados pelo Prisma (`@prisma/client`) que só existem
   depois que `prisma generate` roda a partir do `schema.prisma`. Rodar
   o build do TypeScript antes disso falha com erros como
   `Namespace Prisma has no exported member 'CheckInSource'`. Localmente
   isso não aparecia porque o client já tinha sido gerado antes por outro
   comando — só um build Docker limpo, do zero, expôs o problema.
   Corrigido no `Dockerfile`: `prisma generate` roda antes do `npm run build`.
2. **Motor do Prisma sem libssl na imagem `node:22-bookworm-slim`.** A
   imagem "slim" não inclui OpenSSL; o Prisma precisa dele para o schema
   engine funcionar (erro genérico `Schema engine error:` sem detalhe
   útil, mas com um aviso anterior de "failed to detect libssl/openssl
   version"). Corrigido adicionando
   `RUN apt-get update -y && apt-get install -y openssl` nas duas etapas
   do `Dockerfile` (build e runtime).

## Validação real feita nesta VPS

- `./scripts/install.sh` de ponta a ponta (build das 3 imagens,
  migrations, seed do admin).
- Health check respondendo de **fora** da VPS (não só de dentro).
- Suíte de testes E2E (Playwright) do painel admin rodada contra o
  backend e o painel **de produção reais** (não local) — login, criar
  evento, criar participante, ver/rotacionar QR, importar CSV, criar
  terminal, estatísticas. 3/3 passando.
- Dados de teste (evento/participantes/terminal criados pelos testes E2E)
  removidos do banco de produção depois da validação.

## HTTPS/TLS do backend

O backend também responde em HTTPS real, em
`https://137-131-233-254.sslip.io` (porta 443), necessário pra qualquer
front-end servido em HTTPS (Vercel, etc.) conseguir chamar a API sem
bloqueio de mixed content do navegador. Continua respondendo em HTTP puro
na porta `${PORT}` também (usado pelo app mobile, que não tem essa
restrição de navegador e já tem `usesCleartextTraffic` habilitado).

**Sem domínio próprio ainda** — usa [sslip.io](https://sslip.io) (DNS
público gratuito: `<ip-com-hifens>.sslip.io` resolve pro próprio IP), o
que permite emitir certificado Let's Encrypt real sem precisar comprar
domínio. Quando houver domínio próprio, trocar só isso.

**Portas 80/443 já pertencem a outro cliente** (`fbelegance-nginx`,
projeto separado nesta mesma VPS compartilhada) — não dá pra subir um
proxy TLS próprio nessas portas. A solução foi adicionar um **server
block novo e isolado**, `/home/ubuntu/fbelegance/nginx/conf.d/event-checkin.conf`
(arquivo próprio, não mexe no `default.conf` deles), que só responde pro
hostname `137-131-233-254.sslip.io` e faz proxy pra
`172.25.0.1:3000` (gateway da rede docker do fbelegance, que alcança a
porta publicada do backend no host). O certificado fica isolado em
`/home/ubuntu/event-checkin/certbot/` (config/work/logs próprios, não
compartilha estado com o certbot do fbelegance) — só o **webroot** do
desafio HTTP-01 é compartilhado (`fbelegance_certbot-webroot`, volume já
usado pelo próprio site deles pra isso, seguro pra dois domínios
diferentes usarem o mesmo webroot). Os arquivos do certificado emitido
são copiados (não montados) pro volume `fbelegance_certbot-certs` — que É
o volume que o nginx deles já lê — numa subpasta nova
(`live/137-131-233-254.sslip.io/`), sem tocar na pasta do domínio deles.

**Renovação automática**: cron do root, 3h17 todo dia
(`/home/ubuntu/event-checkin/certbot/renew.sh`) — roda `certbot renew`
isolado, recopia os arquivos pro volume do fbelegance e dá
`docker exec fbelegance-nginx nginx -s reload` (reload gracioso, sem
downtime). Certificado atual expira em 10/11/2026.

**CORS**: além da lista fixa em `CORS_ORIGINS`, o backend aceita
automaticamente qualquer origem `https://*.vercel.app` (ver
`ALLOWED_ORIGINS`/`isVercelPreview` em `src/app.ts`) — necessário porque
cada deploy de preview do Vercel gera um subdomínio novo.

## Limitações conhecidas (ainda não implementado)

- Sem backup automatizado agendado (só o procedimento manual documentado
  em `database.md`).
