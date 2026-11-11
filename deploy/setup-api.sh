#!/usr/bin/env bash
# One-time setup of the API (accounts, synced progress, MCP) on the server that already serves
# the static site. Safe to run again.
#
# Before running:
#   1. Create the GitHub OAuth app and the Google OAuth client (see server/.env.example for the
#      exact callback URLs).
#   2. Put their ids and secrets in server/.env.production (git-ignored), starting from
#      server/.env.example. This script uploads it as server/.env on the server (mode 600).
#
# What it does: builds and tests locally, syncs and starts the API under PM2, installs the HTTPS
# vhost with the proxy rules (backing up the old one, rolling back if Apache rejects it), syncs
# the site, adds a nightly database backup, and checks everything through https.
#
# Usage:
#   ./deploy/setup-api.sh
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config.sh"

ENV_FILE="${DEPLOY_ROOT}/server/.env.production"

echo "== API setup on ${REMOTE_HOST} =="

if [ -f "${ENV_FILE}" ]; then
  if ! grep -q '^PUBLIC_URL=https://' "${ENV_FILE}"; then
    echo "${ENV_FILE}: PUBLIC_URL must be the https origin" >&2
    exit 1
  fi
  if grep -q '^DEV_LOGIN=1' "${ENV_FILE}"; then
    echo "${ENV_FILE}: remove DEV_LOGIN for production" >&2
    exit 1
  fi
elif ! ssh_remote "test -f '${REMOTE_DIR}/server/.env'"; then
  echo "Missing ${ENV_FILE} (and no server/.env on ${REMOTE_HOST})." >&2
  echo "Copy server/.env.example to server/.env.production and fill in the OAuth credentials." >&2
  exit 1
fi

local_build

rsync_server
if [ -f "${ENV_FILE}" ]; then
  echo "-> upload server/.env"
  scp -q "${ENV_FILE}" "${REMOTE_HOST}:${REMOTE_DIR}/server/.env"
  ssh_remote "chmod 600 '${REMOTE_DIR}/server/.env'"
fi
ssh_remote "mkdir -p '${REMOTE_DATA_DIR}' \$HOME/backups/productengineer && chmod 700 '${REMOTE_DATA_DIR}'"
remote_server_install
remote_pm2_reload
api_healthcheck

echo "-> apache: HTTPS vhost with the API proxy"
scp -q "${DEPLOY_ROOT}/deploy/apache-productengineer.pro-le-ssl.conf" "${REMOTE_HOST}:/tmp/${SSL_CONF_NAME}"
ssh_remote "bash -s" <<REMOTE
set -euo pipefail
conf=/etc/apache2/sites-available/${SSL_CONF_NAME}
backup="\${conf}.bak-\$(date +%Y%m%d%H%M%S)"
sudo cp "\${conf}" "\${backup}"
sudo a2enmod proxy proxy_http headers >/dev/null
sudo mv /tmp/${SSL_CONF_NAME} "\${conf}"
if sudo apache2ctl configtest; then
  sudo systemctl reload apache2
  echo "installed; previous vhost kept at \${backup}"
else
  sudo cp "\${backup}" "\${conf}"
  echo "Apache rejected the new vhost; restored \${backup}" >&2
  exit 1
fi
REMOTE

echo "-> nightly database backup (03:30)"
ssh_remote "bash -s" <<REMOTE
set -euo pipefail
line='30 3 * * * cd ${REMOTE_DIR}/server && DB_PATH=${REMOTE_DATA_DIR}/productengineer.sqlite npm run --silent backup -- \$HOME/backups/productengineer >> \$HOME/backups/productengineer/backup.log 2>&1'
( crontab -l 2>/dev/null | grep -v 'productengineer/backup.log' ; echo "\${line}" ) | crontab -
REMOTE

rsync_dist
remote_healthcheck
public_api_healthcheck
echo "done. Sign in at https://${SITE_DOMAIN}/me/ and connect an agent to https://${SITE_DOMAIN}/mcp"
