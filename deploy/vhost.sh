#!/usr/bin/env bash
# Installs deploy/apache-productengineer.pro-le-ssl.conf on the server: the API proxy rules and the
# redirects. Run it after changing that file; deploy.sh does not touch Apache.
#
# Usage:
#   ./deploy/vhost.sh
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/config.sh"

install_vhost
remote_healthcheck
