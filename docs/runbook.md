# Production runbook

These are operator-only procedures. Do not expose them through an application
route: the normal app has no admin role and recovery is deliberately performed
from the trusted host.

## Before the first migration-based deployment

Deploys now run `node migrate.mjs` as the Fly `release_command` (`fly.toml`), so
this happens automatically from here on. The one-time hazard is the *first* such
deploy: the production database was created with `drizzle-kit push`, so it has
the tables but no record of having applied any migration. The migrator would
then run `0000_baseline.sql` from the top, hit `relation "user" already exists`,
and **abort the deploy** — no new Machine takes traffic until it's resolved.

Check first. In the Supabase SQL editor for the production project:

```sql
select count(*) from drizzle.__drizzle_migrations;
```

- **Errors with "schema does not exist", or returns 0** — baseline it, below.
- **Returns 2** (matching `drizzle/meta/_journal.json`) — nothing to do; the
  release command will be a no-op.

Note the schema. Drizzle's postgres-js migrator records state in
`drizzle.__drizzle_migrations`, *not* `public.__drizzle_migrations`
(`drizzle-orm/pg-core/dialect.cjs`: `migrationsSchema ?? "drizzle"`). An earlier
version of this runbook wrote to the wrong one, which silently baselines
nothing.

Baseline, after taking a backup. `shasum -a 256` on macOS, `sha256sum` on Linux:

```bash
BASELINE_HASH="$(shasum -a 256 drizzle/0000_baseline.sql | cut -d ' ' -f1)"
BASELINE_CREATED_AT="$(jq -r '.entries[] | select(.tag == "0000_baseline") | .when' drizzle/meta/_journal.json)"
psql "$DATABASE_URL" -c 'CREATE SCHEMA IF NOT EXISTS "drizzle";'
psql "$DATABASE_URL" -c 'CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" ("id" serial PRIMARY KEY NOT NULL, "hash" text NOT NULL, "created_at" bigint);'
psql "$DATABASE_URL" -c "INSERT INTO \"drizzle\".\"__drizzle_migrations\" (\"hash\", \"created_at\") SELECT '$BASELINE_HASH', $BASELINE_CREATED_AT WHERE NOT EXISTS (SELECT 1 FROM \"drizzle\".\"__drizzle_migrations\" WHERE \"hash\" = '$BASELINE_HASH');"
```

Baseline **only** `0000_baseline`. Later migrations should genuinely run — but
check them first: `0001_harsh_albert_cleary` creates a unique index on
`lower(name)`, so it fails if two existing users share a display name
case-insensitively. Confirm with
`select lower(name), count(*) from "user" group by 1 having count(*) > 1;`
before deploying.

Every later schema change follows this sequence; the deploy applies it:

```bash
bunx drizzle-kit generate
git add drizzle
git push        # release_command applies it before any Machine takes traffic
```

Never run `drizzle-kit push --force` against production.

**If the migration adds a table, hand-add a grant to it.** The admin app reads
this database through `songdraw_admin_ro` (`ops/admin-read-role.sql`), which is
deliberately *not* covered by `ALTER DEFAULT PRIVILEGES` — in a database where
answer secrecy has no enforcement, auto-granting every future table is a
fail-open rule. So append to the generated `drizzle/NNNN_*.sql`:

```sql
GRANT SELECT ON public.<new_table> TO songdraw_admin_ro;
```

Omit it and the admin app fails with `permission denied for table …`, which is
the intended behaviour: loud, one line to fix, and somebody had to decide the
table was safe to expose. If it holds anything secret — a token, a hash, an
unrevealed answer — grant specific columns, or nothing at all.

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
