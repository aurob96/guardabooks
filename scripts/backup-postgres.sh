#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/.env.production}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
POSTGRES_BACKUP_IMAGE="${POSTGRES_BACKUP_IMAGE:-postgres:18}"

if [ ! -f "$ENV_FILE" ]; then
  echo "No existe $ENV_FILE."
  echo "Copia .env.production.example a .env.production y configura DATABASE_URL."
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

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="biblioteca-$(date +%Y%m%d-%H%M%S).dump"

docker run --rm \
  -e DATABASE_URL="$DATABASE_URL" \
  -e BACKUP_FILE="$BACKUP_FILE" \
  -v "$BACKUP_DIR:/backups" \
  "$POSTGRES_BACKUP_IMAGE" \
  sh -c 'pg_dump --format=custom --no-owner --file "/backups/$BACKUP_FILE" "$DATABASE_URL"'

echo "Backup creado en $BACKUP_DIR/$BACKUP_FILE"
