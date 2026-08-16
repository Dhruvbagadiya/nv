#!/usr/bin/env bash
# One-time droplet setup. Run once on a fresh Ubuntu 22.04/24.04 box as root:
#     ssh root@<droplet-ip> 'bash -s' < deploy/bootstrap.sh
#
# Idempotent — safe to re-run.
set -euo pipefail

APP_USER="${APP_USER:-deploy}"
APP_DIR="/home/${APP_USER}/nv-immigration-portal"

echo "==> Packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl git ufw fail2ban

echo "==> Docker"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

echo "==> Deploy user"
id -u "$APP_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$APP_USER"
usermod -aG docker "$APP_USER"
# Carry root's authorised keys over so you can SSH straight in as the deploy user.
if [ -f /root/.ssh/authorized_keys ]; then
  install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/${APP_USER}/.ssh"
  install -m 600 -o "$APP_USER" -g "$APP_USER" \
    /root/.ssh/authorized_keys "/home/${APP_USER}/.ssh/authorized_keys"
fi

echo "==> Firewall"
# Only 22/80/443. The API listens on 4000 but is never published to the host —
# nginx reaches it over the compose network — so 4000 stays closed.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "==> Swap"
# A 1-2GB droplet running `npm ci` for the frontend build will OOM without swap,
# and the failure looks like a mysterious killed process rather than "no memory".
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "==> Unattended security updates"
apt-get install -y -qq unattended-upgrades
dpkg-reconfigure -f noninteractive unattended-upgrades

echo
echo "Done. Next:"
echo "  1. ssh ${APP_USER}@<droplet-ip>"
echo "  2. git clone <repo> ${APP_DIR}"
echo "  3. cp backend/.env.production.example backend/.env.production  # then fill it in"
echo "  4. Edit deploy/nginx.conf — replace app.example.com with your domain"
echo "  5. bash deploy/issue-cert.sh <your-domain> <your-email>"
echo "  6. bash deploy/deploy.sh"
