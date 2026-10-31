#!/usr/bin/env bash
# Deploy or redeploy. Safe to run repeatedly — this is the whole release process.
#
#     bash deploy/deploy.sh
#
# Save it as a Termius snippet and releases become one click.
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE="docker compose -f deploy/docker-compose.prod.yml"
# On the Hostinger box Postgres runs locally; .env.db exists only there.
if [ -f backend/.env.db ]; then
  COMPOSE="$COMPOSE -f deploy/docker-compose.hostinger.yml"
fi

if [ ! -f backend/.env.production ]; then
  echo "backend/.env.production is missing." >&2
  echo "Copy backend/.env.production.example and fill it in first." >&2
  exit 1
fi

echo "==> Pulling latest"
git pull --ff-only

echo "==> Building images"
# The frontend is COMPILED here, not deployed as a separate service: the build
# stage runs `npm run build` and the result is baked into the nginx image. There
# is no "frontend server" to run.
$COMPOSE build

echo "==> Applying database migrations"
# Deliberately a separate step before the new containers take traffic, and never
# on container start — N instances starting at once would race the same
# migration. `migrate deploy` only applies committed migrations and never resets
# data, unlike `migrate dev`.
$COMPOSE run --rm api npx prisma migrate deploy

echo "==> Starting"
$COMPOSE up -d --remove-orphans

echo "==> Waiting for health"
for i in $(seq 1 30); do
  if $COMPOSE ps api | grep -q healthy; then
    echo "    api healthy"
    break
  fi
  [ "$i" = 30 ] && { echo "    api did not become healthy — recent logs:"; $COMPOSE logs --tail=50 api; exit 1; }
  sleep 2
done

echo "==> Pruning old images"
docker image prune -f >/dev/null

echo
echo "Deployed. Logs:  $COMPOSE logs -f api"
