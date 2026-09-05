# SongDraw Admin — build plan

> Written to be handed to a **new, empty repository**. It assumes no knowledge
> of the SongDraw codebase; everything needed is stated here or cited by path.
>
> Kept in this repo rather than only in the admin one, because §3 and the
> prerequisites describe changes **SongDraw itself** must carry: the internal
> admin API, the read role in `ops/admin-read-role.sql`, and the fail-closed
> grant rule in `docs/runbook.md`.
>
> Prerequisites P1 and P3 are **done** (`12d2dba`, `1d5765a`). P2's role has
> been created on production and verified; the SQL is `ops/admin-read-role.sql`.

## Context

SongDraw is a daily "whose song is this?" game for a private friend group:
Next.js 16 App Router + Drizzle + postgres.js against hosted Supabase Postgres,
Better Auth for players, deployed on Fly at `songdraw.party`. It has **no admin
concept whatsoever** — no role column, no permission table, no privileged route.
The only privileged surface is `POST /api/internal/draw`, guarded by a shared
bearer token so the nightly cron can trigger the draw. Operator recovery today
is `psql` from a trusted host, per `docs/runbook.md`.

The goal is a separate admin application on the homelab at
`songdraw.rddk.dev` behind the existing Traefik, giving one operator an
overview of the whole system plus the ability to moderate, operate and support
individual players.

### The two decisions, answered

**Next.js, not Vite.** Vite produces a static SPA with no server, so it would
need an HTTP API to reach the database — the exact new attack surface worth
avoiding. Next.js server components query Postgres directly, with the session in
an httpOnly cookie and no public API at all.

**Same database for reads, over a new least-privilege role. Its own local
database for admin identity. No direct writes, ever.** A second database that
syncs would trade a permissions problem for a replication problem. Direct writes
are ruled out not because they're racy but because **every game invariant lives
in TypeScript, not in Postgres** — one guess per round, the 3-member floor,
played-songs-are-spent, soft-delete-not-delete. Direct SQL bypasses the whole
rulebook. Mutations therefore go through new token-authenticated routes in the
SongDraw app that reuse its existing functions.

---

## Prerequisites — land these in the SongDraw repo first

The admin app is not safe to build until these exist.

**P1. Lock `closeRoundsBefore`.** `lib/draw.ts` selects stale open rounds
*outside* any transaction, then settles them one transaction at a time, and must
process them in `round_date ASC` order. Two callers both see the same rounds as
open and both apply streak increments; because each round flips to `closed` in
the same transaction, a wrong settlement **cannot be replayed away**. Add
`pg_advisory_xact_lock()` as the first statement inside the transaction
(transaction-scoped — session-scoped locks don't work on Supabase's `:6543`
pooler), and re-check `SELECT … WHERE id = $1 AND status = 'open' FOR UPDATE`
inside each per-round transaction. Routing the trigger through HTTP does *not*
fix this: the cron still fires at midnight while you're clicking.

**P2. Check in the role SQL** (below) as an ops file, plus the rule that every
future migration adds its own `GRANT SELECT` line. See "fail-closed" below.

**P3. Fix `deleteUser`.** `lib/auth.ts` has `deleteUser: { enabled: true }`.
Verified cascade: `user → game(owner_id) → members/rounds/guesses/invites` and
`user → bank_song → round → guess`. **Any player can currently delete their
account and destroy other players' history**, leaving everyone else's
`stat_snapshot` counters permanently inflated against rows that no longer exist.
This is a live bug independent of this project.

---

## 1. The read path — Postgres role and grants

Run as `postgres` in the Supabase SQL editor for the **production** project.

```sql
CREATE ROLE songdraw_admin_ro WITH
  LOGIN PASSWORD '<openssl rand -base64 33>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS
  CONNECTION LIMIT 5;

-- Server-side enforcement. The file layout in the app is a convention;
-- this is the actual control. A stray UPDATE fails at the server.
ALTER ROLE songdraw_admin_ro SET default_transaction_read_only = on;
ALTER ROLE songdraw_admin_ro SET statement_timeout = '15s';
ALTER ROLE songdraw_admin_ro SET idle_in_transaction_session_timeout = '30s';

REVOKE ALL ON DATABASE postgres FROM songdraw_admin_ro;
GRANT CONNECT ON DATABASE postgres TO songdraw_admin_ro;
GRANT USAGE ON SCHEMA public TO songdraw_admin_ro;
-- Deliberately NO usage on schema "drizzle": the migration ledger stays
-- invisible so a mispointed drizzle-kit dies instead of fighting the game's
-- migrator over drizzle.__drizzle_migrations.

GRANT SELECT ON TABLE
  public.game, public.game_member, public.game_invite,
  public.round, public.guess, public.stat_snapshot,
  public.bank_song, public.track_asset
TO songdraw_admin_ro;

-- Auth tables: COLUMN-level only. This is the important part.
GRANT SELECT (id, name, email, email_verified, image, created_at, updated_at)
  ON public."user" TO songdraw_admin_ro;
GRANT SELECT (id, user_id, expires_at, created_at, updated_at, ip_address, user_agent)
  ON public.session TO songdraw_admin_ro;   -- NOT "token"
GRANT SELECT (id, user_id, account_id, provider_id, created_at, updated_at)
  ON public.account TO songdraw_admin_ro;   -- NOT "password"
-- public.verification: no grant at all; "value" is a live reset token.
```

**Why column-level matters.** `lib/db/schema.ts` stores `session.token`
**unhashed**, and `proxy.ts` reads exactly that value from the cookie. A
whole-table `SELECT` on `session` is a log-in-as-any-player capability sitting on
a homelab box. `account.password` is the password hash. Never
`GRANT SELECT ON ALL TABLES`, and never `pg_read_all_data`.

Column grants break `SELECT *`. Drizzle always names columns, so this is fine —
and a raw `select *` failing loudly is a feature.

**Fail-closed, not default privileges.** Do *not* set
`ALTER DEFAULT PRIVILEGES … GRANT SELECT ON TABLES`. In a database where answer
secrecy has no enforcement, that auto-grants every future table with no review.
Instead, each new migration in the game repo hand-adds
`GRANT SELECT ON <table> TO songdraw_admin_ro;`. The admin app then breaks with
`permission denied` — loud, one-line fix, and somebody had to think about it.

**Supabase specifics.** The pooler encodes the tenant in the username:
`songdraw_admin_ro.<project-ref>`, not the bare role — a bare name returns
"Tenant or user not found", which looks like a wrong password. Direct `:5432` is
IPv6-only, so a homelab must use `:6543`, which makes `prepare: false`
mandatory. Verify the GUC landed with `show default_transaction_read_only;`
*through the pooler URL*. If anyone ever enables RLS on a game table, this role
(`NOBYPASSRLS`) silently returns **zero rows** rather than erroring — put that in
the runbook.

---

## 2. The admin database (local, Docker)

The admin app fully owns a local Postgres. Admins are **never rows in the game's
`user` table**, so there is no path from a compromised player account to admin,
and an admin can't appear as a member in someone's room.

Tables — note the physical `admin_` prefix, which is load-bearing (§5):

- `admin_user`, `admin_session`, `admin_account`, `admin_verification` — Better
  Auth's four models, renamed.
- `admin_user.game_user_id text NULL` — the operator's *player* id. Not for
  auth: it's how the app knows which games to hide from them (§4).
- `admin_audit` — intent log (§6).

---

## 3. The write path

Every mutation is a new token-authenticated route in the **SongDraw** repo under
`app/api/internal/admin/*`, reusing the existing domain functions. This keeps one
implementation of each invariant. Model them on
`app/api/internal/draw/route.ts`, which already has the token-guard pattern.

Authentication is **not** a bare shared token. The proposed `X-Admin-Actor`
header would be self-asserted — a compromised homelab would hold a write API
*and* control what the audit log said about who used it. Instead:

- `ADMIN_API_TOKEN`, separate from `CRON_TOKEN` (different secret, different
  rotation, different blast radius).
- `X-Admin-Signature`: HMAC-SHA256 over `timestamp + nonce + actor + canonical
  body`. Reject clock skew > 60s and replayed nonces.
- `crypto.timingSafeEqual` for the compare — `app/api/internal/draw/route.ts`
  currently uses `!==`; reuse its `PLACEHOLDER_TOKENS` denylist.
- An `Idempotency-Key` on every mutating route, persisted, so a retry after a
  timeout can't double-apply.
- Rate-limit `/api/internal/*` — it is publicly reachable on Fly.

**The endpoints worth building**, and nothing more:

| Route | Reuses |
|---|---|
| `POST /api/internal/draw` (exists) | replay today's draw; idempotent via `UNIQUE(game_id, round_date)` |
| `POST /api/internal/admin/run-daily` | the *whole* `closeRoundsBefore` + draw job, never a single round |
| `POST /api/internal/admin/game/archive` | sets `game.status`; excludes it from the nightly draw |
| `POST /api/internal/admin/member/remove` | the soft-delete path in `app/api/games/[id]/members/…` |
| `POST /api/internal/admin/invite/cancel` | no derived state |

---

## 4. Spoiler safety — the hard part

There is no RLS and no views: `round.bank_song_id` joins straight to
`bank_song.user_id`. **The operator is also a player**, so an admin panel that
shows today's answer ruins the game it exists to run.

**The settled rule.** Judge "settled" using only the conservative half of
SongDraw's reveal condition — `round.status = 'closed'` **OR** every eligible
member has guessed — deliberately ignoring the 17:00 clock rule. It can then only
over-hide. This also avoids a trap: `revealHour()` in `lib/game-rules.ts` returns
**24 (never)** when `NODE_ENV !== "production"`, so an admin app in development
against production data would consider nothing clock-settled.

Copy the `eligible > 0 && answered >= eligible` guard exactly (`lib/settled-rounds.ts`).
Writing `answered >= eligible` alone makes a game where every non-submitter has
left evaluate `0 >= 0` → settled → reveal.

**Redact in SQL, not in JS.** Deciding whether to hide the answer requires
fetching the answer, which then sits in a server component's locals one careless
prop away from the RSC payload. Return `submitter_user_id` as `NULL` for
unsettled rounds from a single query, so it never enters JavaScript. Better: add
a `security_invoker` view in the game repo's migrations and grant `SELECT` only
on the view — that puts the boundary in Postgres.

**The draw is reproducible from read access — this is the one with no query-level
defence.** `lib/draw.ts` seeds on `` `${gameId}:${roundDate}` `` and iterates
`ORDER BY game_member.id, bank_song.id`. Both inputs are known to any member and
the algorithm is in the repo, so **read access to `bank_song` + `game_member`
computes today's answer without touching `round` at all**. The only defence is
product-level: the admin app must have **no view of bank contents, bank sizes, or
members-with-banked-songs for any game the viewing admin is an active member
of** — which is what `admin_user.game_user_id` is for. Note `bank_song.status`
flipping to `'played'` is itself the answer, so even a bank-size chart is a
permanent spoiler machine.

**Every aggregate needs the same exclusion**, not just the round page.
`lib/game-stats.ts` and `lib/game-insights.ts` apply `notInArray(round.id,
unsettled)` to *every* period including all-time. Raw `stat_snapshot` is a live
spoiler too — `fool_points` is credited the instant someone guesses wrong, which
is the leak commit `5edec51` fixed. Assume the leak will happen in a chart, not
on the page you were careful about.

**Don't give the admin app `REALTIME_CHANNEL_SECRET`.** Payloads are empty, but
the timing of `round:guessed` tells you when the last guess landed.

**Plan for the incident.** If the cron breaks — the main reason to open this app
— nothing is `closed`, so the conservative rule hides everything indefinitely.
Build one deliberate **reveal override**: confirmation dialog, restricted to
`round_date < gameDate()`, logged as a first-class audited action.

---

## 5. The application

**Stack** (mirrors SongDraw so patterns carry over): Next.js 16 App Router,
TypeScript, Tailwind v4, shadcn, Drizzle + postgres.js, Better Auth, Biome.

**Two Drizzle instances, no barrel file.** `src/db/index.ts` must not exist.

```
src/db/game/    schema.ts game.ts bank.ts round.ts track-asset.ts   # vendored copy
                client.ts   → exports `gameDb` only
src/db/admin/   schema.ts   → adminUser, adminSession, …, auditEvent
                client.ts   → exports `adminDb` only
```

Failure modes, worst first:

1. **Table-name collision.** Both schemas need `user`/`session`/`account`/
   `verification`. Nearly identical shapes mean one silently shadows the other
   with no type error. Hence physical `admin_` prefixes.
2. **Better Auth resolving the wrong schema.** The drizzle adapter falls back to
   `db._.fullSchema`. Pass `schema` explicitly. If it ever pointed at the game
   DB, the column-level grants above are what turn a silent cross-database
   authentication into a loud `permission denied`.
3. **`globalThis` cache key collision.** `lib/db/index.ts` caches on
   `globalForDb.songdrawDb` to survive Next's HMR. Copy it twice with the same
   key and the second `postgres()` call never runs. Use distinct keys.
4. **Never name either env var `DATABASE_URL`** — half the ecosystem defaults to
   it, and that's how two migrators end up fighting. Use `GAME_DATABASE_URL` and
   `ADMIN_DATABASE_URL`; the admin `drizzle.config.ts` references only the latter.
5. **Pool sizes.** `gameDb`: `max: 2`, `prepare: false` (mandatory on `:6543`),
   `idle_timeout: 20`. This is one homelab instance on a shared ~200-connection
   budget — it should not take 10 slots for a dashboard opened twice a week.
   `adminDb`: `max: 5`, local, `prepare` can stay on.
6. **Schema drift.** The vendored copy has nothing tying it to the main repo. Add
   a health check that diffs expected columns against `information_schema.columns`
   for the eight granted tables and fails `/api/health` on mismatch.
7. `export const dynamic = "force-dynamic"` on pages reading `gameDb`, or Next
   prerenders the dashboard at build time against an unreachable database.

**Better Auth config — do not copy the game's.** `lib/auth.ts` is tuned for
players and every setting is wrong here:

- **`disableSignUp: true`.** Otherwise `POST /api/auth/sign-up/email` is open on
  an internet-facing admin panel. Seed admins with a script. This is the single
  most likely failure of the whole design.
- A **different `BETTER_AUTH_SECRET`** from the game app.
- Turn **off** `sendResetPassword`, `changeEmail`, `deleteUser`. For two or three
  admins, self-service email reset is a remote-takeover path with no upside.
- Sessions in **hours, not the game's 1 year** (`expiresIn: 60*60*24*365` exists
  for streak durability — the opposite of what an admin session wants).
- `advanced: { cookiePrefix: "songdraw-admin" }`.
- `BETTER_AUTH_URL=https://songdraw.rddk.dev` plus `trustedOrigins`, and Traefik
  must forward `X-Forwarded-Proto: https` — get this wrong and you get a login
  redirect loop that costs an evening.
- Define `relations()` for the admin tables; the adapter looks up `db.query[key]`.
- Add the `twoFactor` plugin if this stays internet-facing. The token this app
  holds can rewrite a live game.

**Screens** (all read-only unless noted): system overview (users, rooms, rounds
today, draw status, dry pools); rooms list → room detail (members, invites,
round history — answers redacted per §4); user lookup → their rooms, streaks,
guess history; a **`stat_snapshot` drift detector** that recomputes expected
values from `guess`+`round` and shows the delta (genuinely useful, and can't hurt
anything); an operations page with the four write actions and the reveal override.

---

## 6. Audit — two logs, one of them evidence

A log on the machine performing the actions is worthless against compromise of
that machine.

- **`admin_audit` in adminDb — intent.** What was clicked, submitted, returned.
  Convenient, searchable, not evidence.
- **`admin_action` in the game DB — record.** Written by the *game app*, inside
  the same transaction as the mutation. This is the one exception to "the admin
  app never writes to the game DB" — and it isn't one, because the game app
  writes it.

Both share a `correlation_id`; without it you can't join intent to effect.
Record: `occurred_at timestamptz` **and** `game_date` (the Adelaide date — "when"
in this system means the game day); actor id/email/session/IP; a **token
fingerprint** (SHA-256 prefix, never the token) so rotations are visible;
`action`, `target_type`, `target_id`, **`game_id`**; redacted request body;
`outcome: attempted → applied | rejected | unknown`, inserted *before* the call so
a timeout leaves a trace; and **`before`/`after` JSONB of every row written** —
the field people skip and then need, because the unreversible operations are
exactly the ones needing a before-image.

Log spoiler-sensitive **reads** too: every reveal override. Redact in the logger,
not at the call site — a stack trace containing `bank_song.user_id` is the leak.
Give `admin_audit` an `INSERT, SELECT`-only local role so it can't be edited, and
ship it off-box.

---

## 7. Never build these

Verified cascades make each of these unrecoverable without a restore.

1. **Delete a user.** Takes every round drawn from their songs in every game,
   every guess on those rounds, every guess naming them, and every game they own.
2. **Delete a `bank_song`**, at any status — `round.bank_song_id` is
   `ON DELETE CASCADE`. Don't build it with a `WHERE status='banked'` guard
   either; that guard is one edit from being the most destructive button you own.
3. **Delete or edit a `guess`.** Counters are incremental with no compensating
   write anywhere in the repo.
4. **Delete or re-draw a `round`.** Re-pointing `bank_song_id` makes already-
   credited points into lies.
5. **Rename a user.** `user.name` *is* the answer to every past round.
6. **Close a single round.** Only "run the daily job", ordered and locked.
7. **Recompute `stat_snapshot`.** Detector yes, button no —
   `docs/runbook.md` requires a reviewed script because membership is historical.
8. **Reactivate a `left` member** while a round is open — it changes the
   `eligible` denominator and can *un-reveal* a revealed round.
9. **Impersonation / "view as player".** One click to the answer, and it means
   the admin app can mint game sessions.
10. Anything touching `session` or `verification`.

---

## Verification

- **Role**: connect as `songdraw_admin_ro` and confirm `select token from
  session` and `select password from account` both fail with `permission denied`,
  that `select value from verification` fails, and that
  `show default_transaction_read_only` returns `on` *through the pooler*. Attempt
  an `UPDATE` and confirm the server rejects it.
- **Isolation**: stop the admin app's local Postgres and confirm the game app is
  entirely unaffected; point `GAME_DATABASE_URL` at a bad host and confirm the
  admin app fails its own health check without touching the game.
- **Spoiler**: with a live round in a game the admin is a member of, confirm the
  room page shows no submitter, no bank contents, no bank sizes, and that every
  chart excludes the unsettled round. Then confirm the same round *is* visible
  after it closes.
- **Write path**: replay `run-daily` twice and confirm exactly one round per game
  per date (the `UNIQUE(game_id, round_date)` guarantee), that streaks are applied
  once, and that both audit logs carry the same `correlation_id`.
- **Concurrency (P1)**: run the daily job from the admin app and the cron
  simultaneously against a seeded database; confirm streaks are applied exactly
  once. This is the test that matters most.
- **Auth**: confirm `POST /api/auth/sign-up/email` returns an error, that an
  admin session cookie is rejected by the game app and vice versa, and that
  cookies are `__Secure-` prefixed behind Traefik.
