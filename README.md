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

Apply schema changes with `bunx drizzle-kit push`.

## Full stack (Docker Compose)

```bash
cp .env.example .env   # then fill in real values
docker compose up -d
```

Services:

- `app` — the Next.js app, built via the root `Dockerfile` (bun for install/build, standalone Node output at runtime)
- `migrate` — runs `drizzle-kit push` against Supabase before `app` starts; idempotent
- `cron` — daily draw trigger (`docker/cron`), fires `POST /api/internal/draw` at midnight Australia/Adelaide
- `ntfy` — notifications (`song-pool-dry`, `song-draw-failed`, `song-new-member` topics)

Ports are remapped from their defaults where they'd collide with other services on the host — check `docker-compose.yml` for the current mapping.

In production, Traefik (already running in the homelab) fronts the app; this compose file doesn't set up its own reverse proxy.
