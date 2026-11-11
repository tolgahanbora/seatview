#!/usr/bin/env bash
set -euo pipefail

HOST="${PGHOST:-127.0.0.1}"
PORT="${PGPORT:-5432}"
ADMIN_DB="${PGADMINDB:-postgres}"
ADMIN_USER="${PGUSER:-$(whoami)}"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql bulunamadı. Homebrew ile: brew install postgresql@16"
  exit 1
fi

if ! nc -z "$HOST" "$PORT" 2>/dev/null; then
  echo "PostgreSQL $HOST:$PORT üzerinde dinlemiyor."
  echo "Homebrew: brew services start postgresql@16"
  echo "veya OrbStack/Docker Desktop açıp npm run db:up çalıştır."
  exit 1
fi

psql -h "$HOST" -p "$PORT" -U "$ADMIN_USER" -d "$ADMIN_DB" -v ON_ERROR_STOP=1 <<'SQL'
DO $$ BEGIN
  CREATE ROLE seatview WITH LOGIN PASSWORD 'seatview';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
SQL

if ! psql -h "$HOST" -p "$PORT" -U "$ADMIN_USER" -d "$ADMIN_DB" -tAc "SELECT 1 FROM pg_database WHERE datname = 'seatview'" | grep -q 1; then
  psql -h "$HOST" -p "$PORT" -U "$ADMIN_USER" -d "$ADMIN_DB" -c "CREATE DATABASE seatview OWNER seatview;"
fi

echo "Hazır: postgresql://seatview:seatview@${HOST}:${PORT}/seatview"
