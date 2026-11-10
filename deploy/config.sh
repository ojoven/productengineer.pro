# Shared by setup.sh (first deploy) and deploy.sh (later deploys). Same pattern as scroller.pro.
# Override any of these in the environment: REMOTE_HOST, REMOTE_DIR, SITE_DOMAIN, ...

REMOTE_HOST="${REMOTE_HOST:-secondary}" # ssh alias for the VPS
REMOTE_DIR="${REMOTE_DIR:-/var/www/html/productengineer.pro/website}"
SITE_DOMAIN="${SITE_DOMAIN:-productengineer.pro}"
SITE_CONF_NAME="${SITE_CONF_NAME:-productengineer.pro.conf}"

DEPLOY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

ssh_remote() {
  ssh -o BatchMode=yes "${REMOTE_HOST}" "$@"
}

# The site is fully static, so it is built here and only dist/ is synced. Astro 7 needs
# Node >= 22.23 (see .nvmrc); building locally avoids depending on the server's Node.
local_build() {
  echo "-> build (node $(node -v))"
  (cd "${DEPLOY_ROOT}" && npm ci && npm test && npm run build)
}

rsync_dist() {
  echo "-> rsync dist/ -> ${REMOTE_HOST}:${REMOTE_DIR}/dist/"
  ssh_remote "mkdir -p '${REMOTE_DIR}/dist'"
  rsync -az --delete --delay-updates "${DEPLOY_ROOT}/dist/" "${REMOTE_HOST}:${REMOTE_DIR}/dist/"
}

remote_healthcheck() {
  echo "-> checking https://${SITE_DOMAIN}/"
  curl -fsS -o /dev/null -w '%{http_code}\n' "https://${SITE_DOMAIN}/"
  curl -fsS -o /dev/null -w '%{http_code}\n' "https://${SITE_DOMAIN}/atlas/measurement/"
}
