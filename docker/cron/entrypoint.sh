#!/bin/sh
set -eu

: "${APP_URL:?APP_URL not set}"
: "${CRON_TOKEN:?CRON_TOKEN not set}"

# TZ is baked into the image as Australia/Adelaide, so "0 0 * * *" fires at
# local midnight regardless of the host's timezone — see GamePlan.md §2.
cat > /etc/crontabs/root <<EOF
0 0 * * * curl -fsS -X POST -H "Authorization: Bearer ${CRON_TOKEN}" "${APP_URL}/api/internal/draw" >> /var/log/cron.log 2>&1
EOF

touch /var/log/cron.log
exec crond -f -l 2
