#!/usr/bin/env bash
# First-time production setup: Apache vhost, TLS, first deploy.
#
# Prerequisites: `ssh secondary` works (BatchMode) and DNS points the domain at
# the server (needed for TLS).
#
# Usage:
#   ./deploy/setup.sh
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config.sh"

echo "== first-time setup on ${REMOTE_HOST} =="
local_build
rsync_dist

echo "-> apache vhost"
scp "${DEPLOY_ROOT}/deploy/apache-productengineer.pro.conf" "${REMOTE_HOST}:/tmp/${SITE_CONF_NAME}"
ssh_remote "bash -s" <<REMOTE
set -euo pipefail
sudo mv /tmp/${SITE_CONF_NAME} /etc/apache2/sites-available/${SITE_CONF_NAME}
sudo a2enmod headers rewrite expires >/dev/null
sudo a2ensite ${SITE_CONF_NAME} >/dev/null
sudo apache2ctl configtest
sudo systemctl reload apache2
sudo certbot --apache -d ${SITE_DOMAIN} -d www.${SITE_DOMAIN} --redirect --non-interactive --agree-tos || echo "certbot failed: run it by hand"
sudo apache2ctl configtest && sudo systemctl reload apache2
REMOTE

remote_healthcheck
echo "done. https://${SITE_DOMAIN}/"
