#!/bin/sh
# ---------------------------------------------------------------------------
# Backend container entrypoint.
#   1. Apply pending Prisma migrations (idempotent, safe to re-run).
#   2. exec the server so it becomes PID 1 and receives SIGTERM for a clean
#      graceful shutdown.
# ---------------------------------------------------------------------------
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] applying database migrations..."
  ./node_modules/.bin/prisma migrate deploy
else
  echo "[entrypoint] RUN_MIGRATIONS disabled, skipping migrations"
fi

echo "[entrypoint] starting TXDXSAT backend..."
exec node dist/server.js
