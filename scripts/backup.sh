#!/usr/bin/env bash
# Backup do PostgreSQL do event-checkin. Roda via cron na VPS (ver
# docs/database.md). Mantém os últimos N dias de backup, apaga o resto.
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-$HOME/event-checkin-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# shellcheck disable=SC1091
set -a; source .env; set +a

mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/event_checkin-$TIMESTAMP.sql.gz"

docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$FILE"

echo "Backup salvo em: $FILE ($(du -h "$FILE" | cut -f1))"

# Remove backups mais antigos que RETENTION_DAYS dias.
find "$BACKUP_DIR" -name "event_checkin-*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

echo "Backups atuais:"
ls -lh "$BACKUP_DIR"
