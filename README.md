# SongDraw

Daily "whose song is this?" for a private friend group. Self-hosted, no Spotify, no OAuth.
See [GamePlan.md](./GamePlan.md) for the full product spec, data model, and milestones.

## Stack

Next.js (App Router, TypeScript, Tailwind) full-stack app, Postgres, Cloudflare R2 (profile picture storage), and a cron sidecar for the daily draw. Package manager is bun.

## Local development

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

This runs the app alone — for auth or the draw job you need the rest of the stack (below).
Avatar uploads need Cloudflare R2 credentials in `.env` (see [docs/object-storage.md](./docs/object-storage.md)); R2 is used in every environment, so there's no local object-storage container.

## Full stack (Docker Compose)

```bash
cp .env.example .env   # then fill in real values
docker compose up -d
```

Services:

- `app` — the Next.js app, built via the root `Dockerfile` (bun for install/build, standalone Node output at runtime)
- `db` — Postgres 16
- `cron` — daily draw trigger (`docker/cron`), fires `POST /api/internal/draw` at midnight Australia/Adelaide
- `ntfy` — notifications (`song-pool-dry`, `song-draw-failed`, `song-new-member` topics)

Ports are remapped from their defaults where they'd collide with other services on the host — check `docker-compose.yml` for the current mapping.

In production, Traefik (already running in the homelab) fronts the app; this compose file doesn't set up its own reverse proxy.
