#!/bin/sh
set -eu

require_value() {
	name="$1"
	eval "value=\${$name:-}"
	if [ -z "$value" ]; then
		echo "$name must be set" >&2
		exit 1
	fi
}

require_secret() {
	require_value "$1"
	eval "value=\${$1}"
	if [ "$value" = "changeme" ] || \
	   [ "$value" = "replace-with-openssl-rand-hex-32" ] || \
	   [ "${#value}" -lt 32 ]; then
		echo "$1 must be a non-placeholder secret of at least 32 characters" >&2
		exit 1
	fi
}

require_value DATABASE_URL
require_value BETTER_AUTH_URL
require_secret BETTER_AUTH_SECRET
require_secret CRON_TOKEN

# Admin writes are opt-in. Reject unsafe configured values before serving.
if [ -n "${ADMIN_API_TOKEN:-}" ]; then
	require_secret ADMIN_API_TOKEN
	if [ "$ADMIN_API_TOKEN" = "$CRON_TOKEN" ]; then
		echo "ADMIN_API_TOKEN must differ from CRON_TOKEN" >&2
		exit 1
	fi
fi

# Feature-request ingest is opt-in too, and its secret is its own.
if [ -n "${INGEST_SHARED_SECRET:-}" ]; then
	require_secret INGEST_SHARED_SECRET
	if [ "$INGEST_SHARED_SECRET" = "$CRON_TOKEN" ] || \
	   [ "$INGEST_SHARED_SECRET" = "${ADMIN_API_TOKEN:-}" ]; then
		echo "INGEST_SHARED_SECRET must differ from CRON_TOKEN and ADMIN_API_TOKEN" >&2
		exit 1
	fi
	require_value ADMIN_INGEST_URL
fi

exec node server.js
