# Shared by setup.sh (first deploy), setup-api.sh (first API deploy) and deploy.sh (later deploys).
# Same pattern as scroller.pro. Override any of these in the environment: REMOTE_HOST, REMOTE_DIR, ...

REMOTE_HOST="${REMOTE_HOST:-secondary}" # ssh alias for the VPS
REMOTE_DIR="${REMOTE_DIR:-/var/www/html/productengineer.pro/website}"
REMOTE_DATA_DIR="${REMOTE_DATA_DIR:-/var/www/html/productengineer.pro/data}"
SITE_DOMAIN="${SITE_DOMAIN:-productengineer.pro}"
SITE_CONF_NAME="${SITE_CONF_NAME:-productengineer.pro.conf}"
SSL_CONF_NAME="${SSL_CONF_NAME:-productengineer.pro-le-ssl.conf}"
PM2_APP="${PM2_APP:-productengineer-api}"
API_PORT="${API_PORT:-8790}"

DEPLOY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ssh_remote() {
  ssh -o BatchMode=yes "${REMOTE_HOST}" "$@"
}

# The site is static, so it is built here and only dist/ is synced. Astro 7 needs
# Node >= 22.23 (see .nvmrc); building locally avoids depending on the server's Node.
# The API's atlas.json is exported from the same content, so site and API never disagree.
local_build() {
  echo "-> build (node $(node -v))"
  (cd "${DEPLOY_ROOT}" && npm ci && npm test && npm run build && npm run export:atlas)
  echo "-> API tests"
  (cd "${DEPLOY_ROOT}/server" && npm ci && npm test)
}

rsync_dist() {
  echo "-> rsync dist/ -> ${REMOTE_HOST}:${REMOTE_DIR}/dist/"
  ssh_remote "mkdir -p '${REMOTE_DIR}/dist'"
  rsync -az --delete --delay-updates "${DEPLOY_ROOT}/dist/" "${REMOTE_HOST}:${REMOTE_DIR}/dist/"
}

# The API runs from source (Node strips the types), so the server folder is synced as is.
# node_modules, the database and .env stay on the server: rsync never deletes excluded files.
rsync_server() {
  echo "-> rsync server/ -> ${REMOTE_HOST}:${REMOTE_DIR}/server/"
  ssh_remote "mkdir -p '${REMOTE_DIR}/server'"
  rsync -az --delete \
    --exclude node_modules/ --exclude data/ --exclude .env --exclude '.env.*' \
    "${DEPLOY_ROOT}/server/" "${REMOTE_HOST}:${REMOTE_DIR}/server/"
}

remote_server_install() {
  echo "-> npm ci on ${REMOTE_HOST}"
  ssh_remote "cd '${REMOTE_DIR}/server' && node -v && npm ci --omit=dev --no-audit --no-fund"
}

remote_pm2_reload() {
  echo "-> pm2 ${PM2_APP}"
  ssh_remote "bash -s" <<EOF
set -euo pipefail
cd "${REMOTE_DIR}/server"
if pm2 describe "${PM2_APP}" >/dev/null 2>&1; then
  pm2 restart "${PM2_APP}" --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save
EOF
}

# Installs deploy/apache-productengineer.pro-le-ssl.conf, keeping a backup of the old vhost and
# restoring it if Apache rejects the new one. Used by setup-api.sh and vhost.sh.
install_vhost() {
  echo "-> apache: HTTPS vhost (proxy rules and redirects)"
  scp -q "${DEPLOY_ROOT}/deploy/apache-productengineer.pro-le-ssl.conf" "${REMOTE_HOST}:/tmp/${SSL_CONF_NAME}"
  ssh_remote "bash -s" <<REMOTE
set -euo pipefail
conf=/etc/apache2/sites-available/${SSL_CONF_NAME}
backup="\${conf}.bak-\$(date +%Y%m%d%H%M%S)"
sudo cp "\${conf}" "\${backup}"
sudo a2enmod proxy proxy_http headers rewrite >/dev/null
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
}

api_healthcheck() {
  echo "-> checking the API on ${REMOTE_HOST} 127.0.0.1:${API_PORT}"
  for i in 1 2 3 4 5; do
    if ssh_remote "curl -fsS http://127.0.0.1:${API_PORT}/api/health"; then
      echo
      return 0
    fi
    sleep 2
  done
  echo "API did not answer; see: ssh ${REMOTE_HOST} pm2 logs ${PM2_APP}" >&2
  return 1
}

remote_healthcheck() {
  echo "-> checking https://${SITE_DOMAIN}/"
  curl -fsS -o /dev/null -w '%{http_code}\n' "https://${SITE_DOMAIN}/"
  curl -fsS -o /dev/null -w '%{http_code}\n' "https://${SITE_DOMAIN}/skills-map/measurement/"
  # the old section URLs answer with a permanent redirect (installed by vhost.sh)
  curl -sS -o /dev/null -w '%{http_code} /atlas/measurement/ -> %{redirect_url}\n' "https://${SITE_DOMAIN}/atlas/measurement/?lit=sample-size"
}

public_api_healthcheck() {
  echo "-> checking the API through Apache"
  curl -fsS "https://${SITE_DOMAIN}/api/health"
  echo
  curl -fsS -o /dev/null -w '%{http_code} /.well-known/oauth-protected-resource/mcp\n' "https://${SITE_DOMAIN}/.well-known/oauth-protected-resource/mcp"
  # without a token the MCP endpoint must answer 401 with a WWW-Authenticate challenge
  curl -sS -o /dev/null -w '%{http_code} /mcp (expect 401)\n' -X POST -H 'Content-Type: application/json' -d '{}' "https://${SITE_DOMAIN}/mcp"
}
