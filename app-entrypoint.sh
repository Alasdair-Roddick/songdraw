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

exec node server.js
