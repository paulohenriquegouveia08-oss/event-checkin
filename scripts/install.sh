#!/usr/bin/env bash
# Instalação do backend + banco + painel admin (web) na VPS. Não requer
# Node/Postgres instalados no host — tudo roda via Docker Compose (ver
# docker-compose.yml).
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== 1/6 Verificando dependências =="
for cmd in docker; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "Erro: '$cmd' não encontrado. Instale o Docker antes de continuar." >&2
    exit 1
  fi
done
if ! docker compose version >/dev/null 2>&1; then
  echo "Erro: 'docker compose' (plugin v2) não encontrado." >&2
  exit 1
fi

echo "== 2/6 Validando configuração =="
if [ ! -f .env ]; then
  echo "Nenhum .env encontrado. Copiando .env.example -> .env"
  cp .env.example .env
  echo
  echo "IMPORTANTE: edite o arquivo .env agora e defina valores reais"
  echo "(POSTGRES_PASSWORD, JWT_SECRET, ADMIN_SEED_*) antes de prosseguir."
  echo "Gere um JWT_SECRET forte com: openssl rand -hex 32"
  read -rp "Pressione Enter depois de editar o .env para continuar... " _
fi

# shellcheck disable=SC1091
set -a; source .env; set +a
if [ "${JWT_SECRET:-troque-este-valor-por-um-segredo-forte}" = "troque-este-valor-por-um-segredo-forte" ]; then
  echo "Erro: JWT_SECRET ainda está com o valor de exemplo. Edite o .env." >&2
  exit 1
fi
if [ "${PUBLIC_API_URL:-http://troque-pelo-ip-da-vps:3000}" = "http://troque-pelo-ip-da-vps:3000" ]; then
  echo "Erro: PUBLIC_API_URL ainda está com o valor de exemplo. Edite o .env com o IP real da VPS." >&2
  exit 1
fi

echo "== 3/6 Construindo e subindo containers (Postgres + migrations + backend + painel admin) =="
docker compose up -d --build

echo "== 4/6 Aguardando o backend responder =="
for i in $(seq 1 30); do
  if curl -sf "http://localhost:${PORT:-3000}/health" >/dev/null 2>&1; then
    echo "Backend respondendo."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Erro: backend não respondeu a tempo. Veja: docker compose logs backend" >&2
    exit 1
  fi
  sleep 2
done

echo "== 5/6 Criando usuário administrador inicial (se ainda não existir) =="
docker compose run --rm --entrypoint "" migrate npm run seed || true

echo "== 6/6 Verificação final =="
curl -sf "http://localhost:${PORT:-3000}/health" && echo
echo
echo "Instalação concluída."
echo "Backend:      ${PUBLIC_API_URL}"
echo "Painel admin: http://<ip-da-vps>:${ADMIN_PORT:-8080}"
echo "Login inicial: ${ADMIN_SEED_EMAIL:-admin@example.com}"
