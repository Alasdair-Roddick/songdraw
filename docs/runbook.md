# Production runbook

These are operator-only procedures. Do not expose them through an application
route: the normal app has no admin role and recovery is deliberately performed
from the trusted host.

## Before the first migration-based deployment

The production database was created with `drizzle-kit push`, so its existing
schema must be recorded as having applied the initial migration. Do this once,
after taking a backup and before deploying the Compose change. The commands
derive the exact values Drizzle records; do not substitute the migration tag
for the file hash.

```bash
BASELINE_HASH="$(sha256sum drizzle/0000_baseline.sql | cut -d ' ' -f1)"
BASELINE_CREATED_AT="$(jq -r '.entries[] | select(.tag == "0000_baseline") | .when' drizzle/meta/_journal.json)"
psql "$DATABASE_URL" -c 'CREATE TABLE IF NOT EXISTS "__drizzle_migrations" ("id" serial PRIMARY KEY NOT NULL, "hash" text NOT NULL, "created_at" bigint);'
psql "$DATABASE_URL" -c "INSERT INTO \"__drizzle_migrations\" (\"hash\", \"created_at\") SELECT '$BASELINE_HASH', $BASELINE_CREATED_AT WHERE NOT EXISTS (SELECT 1 FROM \"__drizzle_migrations\" WHERE \"hash\" = '$BASELINE_HASH');"
```

Use the exact baseline tag documented alongside the migration. A new/empty
database simply runs `bunx drizzle-kit migrate` normally. Every later schema
change follows this sequence:

```bash
bunx drizzle-kit generate
git add drizzle
docker compose run --rm migrate
```

Never run `drizzle-kit push --force` against production.

## Deploy checklist

1. Set every value in `.env`; generate `CRON_TOKEN` and
   `BETTER_AUTH_SECRET` with `openssl rand -hex 32`. Never retain example
   values.
2. Run `bun run check` and `bun run build` from a Bun-capable shell.
3. Take a database backup, then run `docker compose up -d --build`.
4. Confirm `docker compose ps` shows `migrate` exited successfully and `app`
   and `cron` healthy/running.
5. From the host, verify the app through HTTPS and trigger one authenticated
   draw against the internal network:

   ```bash
   docker compose exec cron curl -fsS -X POST \
     -H "Authorization: Bearer $CRON_TOKEN" \
     http://app:3000/api/internal/draw
   ```

6. Complete a three-account smoke test, including an avatar upload, invite,
   draw, wrong guess, correct guess, early reveal, and an iOS preview.

## Backup and restore

Install `scripts/backup-postgres.sh` on the trusted host, where PostgreSQL
client tools are available. It writes atomic custom-format dumps and leaves
existing backups untouched.

```bash
export BACKUP_DIR=/srv/backups/songdraw
./scripts/backup-postgres.sh
pg_restore --list "$BACKUP_DIR/songdraw-<timestamp>.dump" | head
```

Schedule it nightly with the host's existing scheduler. Test restoration into
a separate Supabase project or disposable Postgres database before relying on
the backup:

```bash
createdb songdraw-restore-test
pg_restore --clean --if-exists --no-owner --dbname=songdraw-restore-test \
  "$BACKUP_DIR/songdraw-<timestamp>.dump"
```

Do not restore over production without an explicit incident decision and a
fresh backup of the current state.

## Daily draw incident

The draw endpoint is idempotent by `(game_id, round_date)`. Re-running it is
safe and is the recovery action for a missed cron execution:

```bash
docker compose exec cron curl -fsS -X POST \
  -H "Authorization: Bearer $CRON_TOKEN" \
  http://app:3000/api/internal/draw
```

Check `docker compose logs cron app --since 24h`. A dry-pool result is
expected behaviour, not an incident.

## Force-close an old round

Only close a round once its Adelaide date has passed. The next normal draw
also closes old rounds and settles streaks; use the draw recovery command
above rather than manually mutating a live round whenever possible. If the
normal job cannot run, restore service first, then replay the draw endpoint.

## Stat snapshot recovery

`stat_snapshot` is derived data. If it becomes inconsistent, stop writes,
take a backup, and open an incident. Recompute must be performed with a
reviewed one-off script because membership is historical state; blindly
truncating snapshots would lose valid streak context for members who left.
Record the game ID, affected dates, and validation query in the incident.
