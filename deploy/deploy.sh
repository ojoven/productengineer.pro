#!/usr/bin/env bash
# Later deploys: test and build locally, sync dist/ to the server. Does not touch Apache or TLS.
#
# Usage:
#   ./deploy/deploy.sh
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config.sh"

echo "== deploy -> ${REMOTE_HOST}:${REMOTE_DIR} =="
local_build
rsync_dist
remote_healthcheck
echo "done. https://${SITE_DOMAIN}/"
