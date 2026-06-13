#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
POSTGRES_BACKUP_IMAGE="${POSTGRES_BACKUP_IMAGE:-postgres:18}"

if [ $# -ne 1 ]; then
  echo "Uso: $0 backups/archivo.dump"
  exit 1
fi

BACKUP_PATH="$1"

if [ ! -f "$ENV_FILE" ]; then
  echo "No existe $ENV_FILE."
  exit 1
fi

if [ ! -f "$BACKUP_PATH" ]; then
  echo "No existe $BACKUP_PATH."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Falta DATABASE_URL en $ENV_FILE."
  exit 1
fi

BACKUP_DIR="$(cd "$(dirname "$BACKUP_PATH")" && pwd)"
BACKUP_FILE="$(basename "$BACKUP_PATH")"

docker run --rm \
  -e DATABASE_URL="$DATABASE_URL" \
  -e BACKUP_FILE="$BACKUP_FILE" \
  -v "$BACKUP_DIR:/backups" \
  "$POSTGRES_BACKUP_IMAGE" \
  sh -c 'pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" "/backups/$BACKUP_FILE"'

echo "Backup restaurado desde $BACKUP_PATH"
