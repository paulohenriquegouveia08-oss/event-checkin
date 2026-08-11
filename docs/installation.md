# Instalação (ambiente de desenvolvimento)

Para instalar na VPS de produção, veja [`deployment.md`](deployment.md).
Este documento cobre rodar o backend localmente, fora do Docker.

## Pré-requisitos

- Node.js 22+ e npm
- PostgreSQL 16+ rodando localmente (ou acessível via rede)

## Passos

```bash
# 1. Instalar dependências (workspaces do monorepo)
cd event-checkin
npm install

# 2. Configurar variáveis de ambiente do backend
cp apps/backend/.env.example apps/backend/.env
# Edite apps/backend/.env: DATABASE_URL, JWT_SECRET (openssl rand -hex 32),
# e ADMIN_SEED_* se for usar o seed.

# 3. Criar o banco (se ainda não existir)
psql -U seu_usuario -d postgres -c "CREATE DATABASE event_checkin_dev;"

# 4. Rodar as migrations
npm run backend:migrate

# 5. (opcional) Criar o primeiro usuário administrador
npm run seed --workspace=apps/backend

# 6. Subir o backend em modo desenvolvimento (watch)
npm run backend:dev
```

O servidor sobe em `http://localhost:3000` por padrão (`PORT` no `.env`).
Verifique com:

```bash
curl http://localhost:3000/health
```

## Rodar os testes

```bash
# Cria um banco de teste isolado antes da primeira execução:
psql -U seu_usuario -d postgres -c "CREATE DATABASE event_checkin_test;"

npm run backend:test --workspace=apps/backend
```

Os testes usam `event_checkin_test`, nunca o banco de desenvolvimento —
`tests/setup.ts` força `DATABASE_URL` para esse banco antes de qualquer
módulo da aplicação ser carregado, e `tests/global-setup.ts` aplica as
migrations nele automaticamente antes da suíte rodar.

## Build de produção (sem Docker)

```bash
npm run backend:build
node apps/backend/dist/server.js
```
