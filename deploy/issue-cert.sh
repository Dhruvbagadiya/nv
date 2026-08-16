#!/usr/bin/env bash
# First-time certificate issuance. Run once, before deploy.sh.
#
#     bash deploy/issue-cert.sh app.example.com you@example.com
#
# Chicken-and-egg problem this solves: nginx.conf references certificate files
# that do not exist yet, so nginx will not start — but certbot's webroot
# challenge needs a running web server. So we serve the challenge from a
# throwaway nginx first, get the cert, then start the real stack.
set -euo pipefail

DOMAIN="${1:?usage: issue-cert.sh <domain> <email> [extra-domain ...]}"
EMAIL="${2:?usage: issue-cert.sh <domain> <email> [extra-domain ...]}"
shift 2
# Any further arguments become additional names on the same certificate — one
# cert covering apex + www, rather than two certs to renew.
EXTRA_ARGS=()
for d in "$@"; do EXTRA_ARGS+=(-d "$d"); done
cd "$(dirname "$0")"

mkdir -p certbot/www certbot/conf

echo "==> Temporary challenge server on :80"
docker run --rm -d --name certbot-bootstrap \
  -p 80:80 \
  -v "$PWD/certbot/www:/usr/share/nginx/html:ro" \
  nginx:1.27-alpine

cleanup() { docker rm -f certbot-bootstrap >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "==> Requesting certificate for ${DOMAIN} $*"
docker run --rm \
  -v "$PWD/certbot/conf:/etc/letsencrypt" \
  -v "$PWD/certbot/www:/var/www/certbot" \
  certbot/certbot certonly \
    --webroot -w /var/www/certbot \
    -d "$DOMAIN" "${EXTRA_ARGS[@]}" \
    --email "$EMAIL" \
    --agree-tos --no-eff-email --non-interactive

echo
echo "Certificate issued. Confirm deploy/nginx.conf uses ${DOMAIN}, then run deploy.sh."
echo "Renewal is automatic — the certbot service in docker-compose.prod.yml checks every 12h."
