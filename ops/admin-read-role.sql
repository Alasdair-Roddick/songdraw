-- Least-privilege read role for the separate admin application.
--
-- Run as `postgres` in the Supabase SQL editor for the target project. Checked
-- in because it does NOT survive a restore into a new project or a branch
-- reset, and because reconstructing it from memory is how the column grants
-- below get quietly widened.
--
-- The admin app connects with this role and never writes. Every mutation goes
-- through SongDraw's own token-authenticated internal API, because the game's
-- invariants live in TypeScript, not in Postgres — one guess per round, the
-- MIN_MEMBERS floor, played-songs-are-spent, soft-delete-not-delete. Direct SQL
-- bypasses the entire rulebook.

BEGIN;

CREATE ROLE songdraw_admin_ro WITH
  LOGIN PASSWORD 'CHANGE-ME'   -- openssl rand -base64 33
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS
  -- The only backstop on the shared ~200-connection pooler budget if the admin
  -- app ever leaks pools. The game app itself runs max: 10 per instance.
  CONNECTION LIMIT 5;

-- Server-side enforcement. File layout in the admin app is a convention; this
-- is the actual control — a stray UPDATE fails at the server, not in review.
ALTER ROLE songdraw_admin_ro SET default_transaction_read_only = on;
ALTER ROLE songdraw_admin_ro SET statement_timeout = '15s';
ALTER ROLE songdraw_admin_ro SET idle_in_transaction_session_timeout = '30s';

REVOKE ALL ON DATABASE postgres FROM songdraw_admin_ro;
GRANT CONNECT ON DATABASE postgres TO songdraw_admin_ro;
GRANT USAGE ON SCHEMA public TO songdraw_admin_ro;

-- Deliberately NO usage on schema "drizzle". The migration ledger stays
-- invisible so a drizzle-kit accidentally pointed at this URL dies immediately
-- instead of fighting the game's migrator over drizzle.__drizzle_migrations
-- and aborting deploys.

-- Game tables: whole-table SELECT. Nothing secret lives in them.
GRANT SELECT ON TABLE
  public.game,
  public.game_member,
  public.game_invite,
  public.round,
  public.guess,
  public.stat_snapshot,
  public.bank_song,
  public.track_asset
TO songdraw_admin_ro;

-- Auth tables: COLUMN-level only, and this is the important part.
--
-- lib/db/schema.ts stores session.token UNHASHED, and proxy.ts reads exactly
-- that value out of the cookie. A whole-table SELECT on session is therefore a
-- log-in-as-any-player capability sitting on a homelab box. account.password is
-- the password hash. verification.value is a live password-reset token.
--
-- Never `GRANT SELECT ON ALL TABLES IN SCHEMA public`, and never
-- `GRANT pg_read_all_data` — both hand over all three.
GRANT SELECT (id, name, email, email_verified, image, created_at, updated_at)
  ON public."user" TO songdraw_admin_ro;

GRANT SELECT (id, user_id, expires_at, created_at, updated_at, ip_address, user_agent)
  ON public.session TO songdraw_admin_ro;          -- NOT token

GRANT SELECT (id, user_id, account_id, provider_id, created_at, updated_at)
  ON public.account TO songdraw_admin_ro;          -- NOT password

-- public.verification: no grant at all.

COMMIT;

-- ── Fail closed ─────────────────────────────────────────────────────────────
-- Deliberately NOT setting:
--
--   ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
--     GRANT SELECT ON TABLES TO songdraw_admin_ro;
--
-- In a database where answer secrecy has no enforcement, that is a fail-OPEN
-- rule: every future table auto-grants with no review. Instead each new
-- migration hand-adds its own `GRANT SELECT ON <table> TO songdraw_admin_ro;`
-- next to the CREATE TABLE. The admin app then breaks with "permission denied",
-- which is loud, obvious, and a one-line fix somebody had to think about.

-- ── Verify (run these after) ────────────────────────────────────────────────
-- Connect through the POOLER as songdraw_admin_ro.<project-ref> — Supavisor
-- encodes the tenant in the username, and a bare role name returns
-- "Tenant or user not found", which reads like a wrong password. Direct :5432
-- is IPv6-only, so a homelab must use :6543, which makes prepare:false
-- mandatory (same reason as lib/db/index.ts).
--
--   show default_transaction_read_only;        -- expect: on
--   select count(*) from "user";               -- expect: works
--   select token from session limit 1;         -- expect: permission denied
--   select password from account limit 1;      -- expect: permission denied
--   select value from verification limit 1;    -- expect: permission denied
--   update game set name = name;               -- expect: read-only transaction
--
-- Note: column grants break `select *`. Drizzle always names its columns, so
-- that is fine, and a raw `select *` failing loudly is a feature.

-- ── Rotation and gotchas ────────────────────────────────────────────────────
-- Rotate with `ALTER ROLE songdraw_admin_ro PASSWORD '...'`; the Supabase
-- dashboard's Roles UI won't manage this role. Supavisor's credential cache
-- takes a few seconds to settle.
--
-- If anyone ever enables RLS on a game table, this role is NOBYPASSRLS and will
-- silently return ZERO ROWS rather than erroring — the admin app will look like
-- an empty database. That is the first thing to check if it ever goes blank.
