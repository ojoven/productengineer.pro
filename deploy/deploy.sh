#!/usr/bin/env bash
# Later deploys: test and build locally, update the API, then sync the site. Does not touch
# Apache, TLS, the database or the API's .env. Run setup-api.sh once before the first deploy
# that includes the API.
#
# Usage:
#   ./deploy/deploy.sh
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config.sh"

echo "== deploy -> ${REMOTE_HOST}:${REMOTE_DIR} =="
local_build
# the API first, so the new pages never call an API that does not have their endpoints yet
rsync_server
remote_server_install
remote_pm2_reload
api_healthcheck
indexnow_snapshot
rsync_dist
remote_healthcheck
public_api_healthcheck
indexnow_submit
echo "done. https://${SITE_DOMAIN}/"
