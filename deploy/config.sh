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

# ---- IndexNow (https://www.indexnow.org): tells Bing, Yandex, Seznam and others which pages
# changed, so they crawl them soon. The key file lives in public/ and is served from the root.
INDEXNOW_KEY="${INDEXNOW_KEY:-07d1134de0470d8266ce5de16d5d1365}"
INDEXNOW_TMP="${INDEXNOW_TMP:-$(mktemp -d)}"

# One line per page: a hash of its HTML without asset file names (they change with every style or
# script edit, which is not a content change), then its path. Run inside a dist/ folder.
page_hashes() {
  find . -name index.html -type f | sort | while IFS= read -r f; do
    printf '%s %s\n' "$(sed -E 's#/_astro/[^"'"'"' )]+##g' "$f" | md5sum | cut -c1-32)" "${f#./}"
  done
}

# Before rsync_dist: which pages are new or changed compared with production, and which are gone.
indexnow_snapshot() {
  echo "-> indexnow: compare pages with production"
  { declare -f page_hashes; echo 'cd "$1" 2>/dev/null && page_hashes || true'; } \
    | ssh_remote "bash -s -- '${REMOTE_DIR}/dist'" > "${INDEXNOW_TMP}/remote"
  (cd "${DEPLOY_ROOT}/dist" && page_hashes) > "${INDEXNOW_TMP}/local"
  LC_ALL=C sort -o "${INDEXNOW_TMP}/remote" "${INDEXNOW_TMP}/remote"
  LC_ALL=C sort -o "${INDEXNOW_TMP}/local" "${INDEXNOW_TMP}/local"
  : > "${INDEXNOW_TMP}/paths"
  # new or changed pages, except noindex pages and redirects
  LC_ALL=C comm -13 "${INDEXNOW_TMP}/remote" "${INDEXNOW_TMP}/local" | cut -d' ' -f2- | while IFS= read -r f; do
    grep -qE 'name="robots" content="noindex"|http-equiv="refresh"' "${DEPLOY_ROOT}/dist/${f}" || echo "${f}"
  done >> "${INDEXNOW_TMP}/paths"
  # pages that no longer exist
  LC_ALL=C comm -23 <(cut -d' ' -f2- "${INDEXNOW_TMP}/remote" | LC_ALL=C sort) <(cut -d' ' -f2- "${INDEXNOW_TMP}/local" | LC_ALL=C sort) >> "${INDEXNOW_TMP}/paths"
  echo "   $(wc -l < "${INDEXNOW_TMP}/paths") page(s) to submit"
}

# After the new dist/ is live. A failure here never fails the deploy.
indexnow_submit() {
  local n
  n=$(wc -l < "${INDEXNOW_TMP}/paths")
  if [ "${n}" -eq 0 ]; then echo "-> indexnow: nothing changed"; return 0; fi
  echo "-> indexnow: submit ${n} URL(s)"
  SITE_DOMAIN="${SITE_DOMAIN}" INDEXNOW_KEY="${INDEXNOW_KEY}" node - "${INDEXNOW_TMP}/paths" <<'JS' || echo "   indexnow failed; the deploy itself is fine"
const fs = require('node:fs');
const host = process.env.SITE_DOMAIN;
const key = process.env.INDEXNOW_KEY;
const urlList = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean)
  .map((f) => `https://${host}/${f.replace(/index\.html$/, '')}`);
(async () => {
  for (let i = 0; i < urlList.length; i += 10000) {
    const send = () => fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: `https://${host}/${key}.txt`, urlList: urlList.slice(i, i + 10000) }),
    });
    let res = await send();
    // 403 means the key was not verified yet; on the first deploy with a new key it passed a few seconds later
    if (res.status === 403) { await new Promise((ok) => setTimeout(ok, 15000)); res = await send(); }
    console.log(`   ${res.status} ${res.statusText} (${urlList.slice(i, i + 10000).length} URLs)`);
    if (res.status >= 400) process.exitCode = 1;
  }
})();
JS
}
