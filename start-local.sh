#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/apps/api"
WEB_DIR="$ROOT_DIR/apps/web"
ENV_FILE="$ROOT_DIR/.env.local"

if [ -f "$ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
elif [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  source "$ROOT_DIR/.env"
  set +a
fi

export API_PORT="${API_PORT:-4000}"
export WEB_PORT="${WEB_PORT:-5173}"
export API_START_TIMEOUT="${API_START_TIMEOUT:-120}"
export ANTHROPIC_MODEL="${ANTHROPIC_MODEL:-claude-sonnet-4-6}"
export VITE_API_URL="${VITE_API_URL:-/api}"

if [[ "$VITE_API_URL" == http://localhost:* || "$VITE_API_URL" == http://127.0.0.1:* ]]; then
  echo "VITE_API_URL apunta a localhost; se usara /api para que tambien funcione desde celular."
  export VITE_API_URL="/api"
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "Falta DATABASE_URL."
  echo "Crea $ENV_FILE con tu URL de PostgreSQL. Puedes copiar .env.local.example."
  exit 1
fi

if [[ "$DATABASE_URL" == *"@db:"* ]]; then
  echo "Tu DATABASE_URL apunta a '@db', que solo funciona dentro de Docker."
  echo "Para Node local usa una URL real de PostgreSQL, por ejemplo Neon/Supabase o localhost."
  echo "Edita $ENV_FILE y vuelve a ejecutar ./start-local.sh"
  exit 1
fi

if [ ! -d "$API_DIR/node_modules" ]; then
  echo "Instalando dependencias de la API..."
  (cd "$API_DIR" && npm install)
fi

if [ ! -d "$WEB_DIR/node_modules" ]; then
  echo "Instalando dependencias de la web..."
  (cd "$WEB_DIR" && npm install)
fi

if [ "${SYNC_DB:-0}" = "1" ]; then
  echo "Sincronizando base de datos..."
  (cd "$API_DIR" && npm run prisma:generate && npm run prisma:push)
fi

if command -v lsof >/dev/null 2>&1; then
  API_PORT_PID="$(lsof -ti tcp:"$API_PORT" -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  if [ -n "$API_PORT_PID" ]; then
    echo "El puerto ${API_PORT} ya esta ocupado."
    echo "Cierra la instancia anterior con:"
    echo "  kill ${API_PORT_PID}"
    echo
    echo "O arranca la API en otro puerto:"
    echo "  API_PORT=4001 ./start-local.sh"
    exit 1
  fi
fi

cleanup() {
  echo
  echo "Cerrando Biblioteca..."
  kill "${API_PID:-}" "${WEB_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "Iniciando API en http://localhost:${API_PORT}/api"
(cd "$API_DIR" && npm run dev) &
API_PID=$!

echo "Esperando a que la API responda... puede tardar si la base remota esta despertando."
API_READY=0
for ((attempt = 1; attempt <= API_START_TIMEOUT; attempt++)); do
  if ! kill -0 "$API_PID" 2>/dev/null; then
    echo "La API se cerro antes de responder."
    echo "Revisa las lineas anteriores de la Terminal: normalmente es DATABASE_URL, conexion a PostgreSQL o puerto ocupado."
    exit 1
  fi

  if curl -fsS "http://localhost:${API_PORT}/api/health" >/dev/null 2>&1; then
    API_READY=1
    break
  fi

  sleep 1
done

if [ "$API_READY" != "1" ]; then
  echo "La API no respondio en http://localhost:${API_PORT}/api/health."
  echo "Revisa que PostgreSQL este activo y que DATABASE_URL apunte a una base accesible."
  echo "Si usas una base remota, revisa tambien que tengas internet y que la URL acepte conexiones desde tu red."
  exit 1
fi

echo "Iniciando web en http://localhost:${WEB_PORT}"
(cd "$WEB_DIR" && npm run dev -- --host 0.0.0.0 --port "$WEB_PORT") &
WEB_PID=$!

LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || true)"

echo
echo "Biblioteca esta arrancando:"
echo "  Web: http://localhost:${WEB_PORT}"
if [ -n "$LAN_IP" ]; then
  echo "  Celular en la misma red: http://${LAN_IP}:${WEB_PORT}"
fi
echo "  API: http://localhost:${API_PORT}/api/health"
echo
echo "Presiona Ctrl+C para cerrar API y web."

wait "$API_PID" "$WEB_PID"
