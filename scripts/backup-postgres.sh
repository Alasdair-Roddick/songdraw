#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${BACKUP_DIR:?BACKUP_DIR must be set}"

mkdir -p "$BACKUP_DIR"
timestamp="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
target="$BACKUP_DIR/songdraw-$timestamp.dump"
temporary="$target.partial"

trap 'rm -f "$temporary"' EXIT
pg_dump --dbname="$DATABASE_URL" --format=custom --no-owner --no-acl --file="$temporary"
mv "$temporary" "$target"
trap - EXIT

echo "Wrote $target"
