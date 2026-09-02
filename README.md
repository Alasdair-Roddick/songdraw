# SongDraw

Daily "whose song is this?" for a private friend group. Self-hosted, no Spotify, no OAuth.
See [GamePlan.md](./GamePlan.md) for the full product spec, data model, and milestones.

## Stack

Next.js (App Router, TypeScript, Tailwind) full-stack app, hosted Supabase Postgres (plus Supabase Realtime for invite notifications), Cloudflare R2 (profile picture storage), and a cron sidecar for the daily draw. Package manager is bun.

## Local development

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

This runs the app alone — for the draw job you need the rest of the stack (below).

Both managed dependencies are used in every environment, so there is no local
container for either — you need real credentials in `.env.local` to run at all:

- **Supabase** — `DATABASE_URL` for Postgres, plus `NEXT_PUBLIC_SUPABASE_URL` /
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `REALTIME_CHANNEL_SECRET` for invite
  notifications (see [docs/notifications.md](./docs/notifications.md))
- **Cloudflare R2** — avatar uploads (see [docs/object-storage.md](./docs/object-storage.md))

Generate a migration after changing the schema with `bunx drizzle-kit generate`,
then apply it with `bunx drizzle-kit migrate`. See
[docs/runbook.md](./docs/runbook.md) for the one-time baseline procedure for an
existing database and the production deployment checklist.

### Simulating the daily loop

Rounds are drawn by cron at 00:00 Australia/Adelaide, which makes the play
screen hard to reach in dev. A **Dev only** panel appears on the game page
outside production with three actions (`POST /api/dev/round`, which 404s in
production and is still membership-gated):

- **Draw now** — draws today's round immediately. No-op if one already exists.
- **Advance a day** — pushes existing rounds back one day, settles the ones
  that fall into the past (closing them and updating streaks), then draws a
  fresh round for today. Shifting history backwards rather than faking a clock
  keeps `gameDate()` honest, so every read path still sees a live round today.
- **Reset rounds** — deletes the game's rounds and stats and returns played
  songs to the pool. Songs retired by a member leaving stay retired.

You need 3 members and at least one banked song before a draw can do anything.

In production rounds reveal at 17:00 Adelaide (or once everyone has guessed),
and guessing closes at the same moment. **Outside production that clock
deadline is off by default**, since otherwise any evening dev session finds
every round already revealed with no picker. Reveal-on-everyone-guessed still
applies, so the mechanic is fully testable.

Set `DEV_REVEAL_HOUR` in `.env.local` to exercise the deadline itself — `17`
for real behaviour, `0` to force everything revealed.

## Full stack (Docker Compose)

```bash
cp .env.example .env   # then fill in real values
docker compose up -d
```

Services:

- `app` — the Next.js app, built via the root `Dockerfile` (bun for install/build, standalone Node output at runtime)
- `migrate` — applies committed Drizzle migrations against Supabase before `app` starts
- `cron` — daily draw trigger (`docker/cron`), fires `POST /api/internal/draw` at midnight Australia/Adelaide
- `ntfy` — notifications (`song-pool-dry`, `song-draw-failed`, `song-new-member` topics)

Ports are remapped from their defaults where they'd collide with other services on the host — check `docker-compose.yml` for the current mapping.

In production, Traefik (already running in the homelab) fronts the app; this compose file doesn't set up its own reverse proxy.
