# Admin write API

SongDraw implements four signed POST routes under `/api/internal/admin/`:

| Route | JSON body | Success response |
| --- | --- | --- |
| `run-daily` | `{}` | `{ date, closed, created, exists, dry, below_minimum, failed }` |
| `game/archive` | `{ gameId, status: "archived" \| "active" }` | `{ status }` |
| `member/remove` | `{ gameId, memberId }` | `{ status: "removed" }` |
| `invite/cancel` | `{ inviteId }` | `{ status: "cancelled" }` |

The daily job is shared with `/api/internal/draw`. Removal, cancellation and
archiving use the same domain functions as the player/account paths. An owner
cannot be removed; ownership must be transferred first. Members are soft-removed,
invites must be pending, and archiving only changes the game's status.

## Deploy and migrate

1. Provision `songdraw_admin_ro` with `ops/admin-read-role.sql` if it does not
   already exist. Use the real role provisioning process, not the NOLOGIN role
   used by the disposable integration tests.
2. Review and apply `drizzle/0002_admin_write_api.sql` through the existing
   migrator. It creates all three tables and explicitly grants SELECT on
   `admin_action` only. The grant is unconditional: a missing role aborts the
   migration and deploy. Do not use `drizzle-kit push`, which omits this grant.
   Fly's release command applies committed migrations automatically on deploy.
3. Set a fresh `ADMIN_API_TOKEN` on Fly and the admin host. Generate it with
   `openssl rand -hex 32`; it must differ from `CRON_TOKEN`. Unset/empty disables
   the admin API. A configured placeholder, short token, or shared cron token
   fails server startup. No live credentials belong in the denylist.
4. Set `SONGDRAW_API_URL` on the admin host to the staging game app first.

No production migration or secret configuration is performed by the implementation
or its tests. The operator supplies the target environment before migration.

## Signing and retries

Send `Content-Type: application/json`, `Authorization: Bearer <ADMIN_API_TOKEN>`,
`X-Admin-Actor` (operator email), `X-Admin-Timestamp` (Unix seconds),
`X-Admin-Nonce` (32 random hex characters), `X-Admin-Correlation-Id` (UUID),
`Idempotency-Key` (UUID), and `X-Admin-Signature: v1=<hex HMAC-SHA256>`.

The HMAC uses `ADMIN_API_TOKEN` and the following seven fields joined by a single
newline, without a trailing newline:

```text
v1
POST
/api/internal/admin/<route>
<timestamp>
<nonce>
<actor>
<SHA256 hex of the exact UTF-8 request body bytes>
```

Serialize once and sign those bytes. Do not normalize JSON or its Unicode escapes.
Fields cannot contain newlines. The signature format intentionally matches the
admin application's contract; correlation and idempotency headers are not added
to its canonical string.

Verification checks bearer, ±60-second skew, nonce reuse, signature, then stored
idempotency response, before parsing JSON. Body size is capped at 16 KiB. Only
the documented fields are accepted and written to the request-body audit field.

Retry an unknown outcome with the **same key and body**, a fresh timestamp and
nonce, and a new signature. Stored successes and domain/validation refusals are
returned with their original status and body. A retry adds no second action row.
A reused key with another route, body bytes or actor returns 409. Use a new key
for a new operator intent. Idempotency entries are retained indefinitely.

2xx means applied; 4xx except 408 means definitively refused; 408, 5xx and a lost
response mean unknown. Errors contain `{ "error": "one sentence" }`. A daily
response can contain `failed > 0`: successful games committed, each failed game's
savepoint rolled back. Start a new daily intent/key to retry those failed games;
replaying the old key returns the original counts.

Each internal route, including cron, allows 10 requests per rolling minute per
server process, including failed authentication. A 429 includes `Retry-After: 60`.
Buckets use fixed route names, not caller-controlled headers. This is a local
process limit: multiple Fly processes each have their own budget, and restarts
reset it. Nonces and idempotency remain database-backed across all processes.

## Transactions and evidence

The nonce insert, domain changes, `admin_action`, and stored response commit in
one transaction. An advisory transaction lock serializes each idempotency key;
the nonce primary key catches simultaneous copies. Entries older than five
minutes are pruned when a new verified action is recorded. Invalid signatures
cannot consume a nonce, claim a key, or assert an actor in the audit table.

Both cron and admin hold the same transaction-scoped daily-job lock. Settlement
retains its per-game lock and open-row recheck, processing dates oldest first
within each game. Games are visited in stable ID order. The whole admin job,
including settlement, rolls back if its evidence cannot be recorded. Realtime
notifications run after commit and do not change the recorded result.

Audit identity comes from the signed envelope. `token_fp` is the first 12 hex
characters of SHA256(token), never the token. Each before/after state is an array
of `{ table, row }` entries in write order, with full Drizzle row fields and `null`
for the before-image of an insert. Multiple settlements may record successive
versions of the same stat row. A domain refusal with an existing target records
that unchanged row in both states; missing/invalid targets have empty states.
There are no auth/session/credential rows in this audit path. Daily evidence
contains song ownership and must be treated as spoiler-sensitive in the admin UI.

## Verification

`bun run check` runs lint, typecheck and unit tests. The database suite is skipped
unless `ADMIN_TEST_DATABASE_URL` is explicitly supplied. It accepts only localhost
and the database name `songdraw_admin_test`, and **resets that test database's
tables**. CI provisions disposable Postgres and runs the suite automatically.

```sh
docker run --detach --rm --name songdraw-admin-test \
  --publish 127.0.0.1:55439:5432 \
  --env POSTGRES_PASSWORD=songdraw-local-test \
  --env POSTGRES_DB=songdraw_admin_test postgres:16

ADMIN_TEST_DATABASE_URL=postgres://postgres:songdraw-local-test@127.0.0.1:55439/songdraw_admin_test bun run check

docker stop songdraw-admin-test
```

Tests apply the committed migration, check grants, exercise all four handlers,
verify exact signatures and status codes, race nonce/key retries, inject an audit
failure to prove rollback, and overlap admin/cron with two stale seeded rounds to
verify streaks settle exactly once and the daily evidence includes every write.

The separate admin repository's `bun run contract-check` and Operations screen
still need staging verification: compare each `admin_audit.correlation_id` to
`admin_action.correlation_id`, run/retry the daily job, and stop the staging game
app during a request to confirm the admin records `unknown`. These cross-app
checks require the deployed staging applications and are not simulated by claiming
that a local handler test exercised the UI or network interruption.
