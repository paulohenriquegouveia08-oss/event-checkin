#!/usr/bin/env bash
# Restaura um backup gerado por scripts/backup.sh.
# Uso: ./scripts/restore.sh /caminho/para/event_checkin-20260101-0000.sql.gz
#
# CUIDADO: isso sobrescreve os dados atuais do banco. Confirma antes de rodar.
set -euo pipefail
cd "$(dirname "$0")/.."

FILE="${1:?Uso: ./scripts/restore.sh <arquivo.sql.gz>}"
if [ ! -f "$FILE" ]; then
  echo "Erro: arquivo não encontrado: $FILE" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; source .env; set +a

echo "ATENÇÃO: isso vai sobrescrever o banco '$POSTGRES_DB' com o conteúdo de:"
echo "  $FILE"
read -rp "Digite 'restaurar' para confirmar: " confirm
if [ "$confirm" != "restaurar" ]; then
  echo "Cancelado."
  exit 1
fi

gunzip -c "$FILE" | docker compose exec -T db psql -U "$POSTGRES_USER" "$POSTGRES_DB"
echo "Restauração concluída."
