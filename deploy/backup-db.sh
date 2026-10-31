#!/usr/bin/env bash
# Daily dump of the on-box Postgres (Hostinger setup). Run from cron:
#     0 2 * * * /home/deploy/nv-immigration-portal/deploy/backup-db.sh >> /home/deploy/backups/backup.log 2>&1
#
# Keeps the last KEEP_DAYS dumps in BACKUP_DIR. These sit on the same disk as
# the database, so they protect against mistakes, not against losing the server:
# copy them off the box (e.g. to your PC) now and then.
set -euo pipefail
cd "$(dirname "$0")/.."

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"
COMPOSE="docker compose -f deploy/docker-compose.prod.yml -f deploy/docker-compose.hostinger.yml"

mkdir -p "$BACKUP_DIR"
out="$BACKUP_DIR/nv-portal_$(date +%Y-%m-%d_%H%M).dump"

# Write to a temp name first so a failed dump never looks like a good one.
$COMPOSE exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -Z 6' > "$out.partial"
mv "$out.partial" "$out"

find "$BACKUP_DIR" -name 'nv-portal_*.dump' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) backup ok: $out ($(du -h "$out" | cut -f1))"
