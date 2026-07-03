# SongDraw v2 — Project Plan
*Daily "whose song is this?" for a private friend group. No Spotify. No OAuth. No user cap.*
*Self-hosted at `song.roddickshare.space`*

---

## 1. Product definition

**Premise.** A persistent **Game** is created by one user, who shares an invite link (`/game/join/{uuid}`, valid 24h, re-issuable). Joining requires two things: a display name and **your first song submission**. Once ≥2 members exist, a daily round begins.

**The daily loop:**
1. Each day, one pooled song is drawn. Every member (except the submitter) answers one question: **whose song is this?**
2. After guessing, the answer is revealed immediately.
3. The reveal screen prompts: **add a song for tomorrow's pool** — your lottery ticket for having your song played.

**The submitter's day.** When your song is drawn you don't guess — you *earn*. Every member who guesses wrong pays you points. Submission is therefore a bluffing move: obvious anthem, deep cut, or a psyop track engineered to frame someone else.

**Why this loop retains:** playing gates submitting, so the pool is only fed by active players; "is my song getting played today" drives the daily open; "who did I fool" drives the reveal check. Two hooks per day, ~40 seconds of interaction.

---

## 2. Game rules (locked)

- **Draw:** two-stage. First pick a member uniformly at random from members with ≥1 pooled song, then pick one of their pooled songs at random. Equal daily odds regardless of pool size; banked songs keep hope alive.
- **Song lifecycle:** `pooled → played → retired`. Played songs never repeat. A leaving member's pool retires with them.
- **Submission rights:** one submission per completed round (play first, then submit). Plus the mandatory join submission. Unpicked songs roll over.
- **Duplicate rule:** a track already pooled or played in the game can't be submitted again (server rejects with a friendly "someone beat you to it").
- **Scoring v1:** guesser +100 for correct (single attempt). Submitter +50 per wrong guess. Missed round = 0 and streak reset; banked songs stay pooled.
- **Streaks:** consecutive days *played* (guessed, or was the submitter). Submitter days count automatically.
- **Reveal:** immediately after your own guess. Share grid is spoiler-light: `Song #23 🟩 streak 7` / `🟥 streak 0`, no names.
- **Day boundary:** 00:00 Australia/Adelaide, hard-coded. Round opens at midnight, closes at next midnight; unplayed = missed.
- **Degenerate cases:** rounds generate with ≥2 members but the guess is only interesting at ≥3 — UI nudges "invite one more." If no member has a pooled song at draw time, the day is skipped and ntfy alerts the owner ("pool is dry").
- **Audio:** the drawn track's 30-second preview (from iTunes/Deezer metadata) is playable on the guess screen. Album art shown. This is flavour, not a dependency — the game works fully on metadata.

---

## 3. Tech stack

**Music metadata — iTunes Search API (primary), Deezer (fallback), behind a `MusicProvider` interface.**
Both are keyless, OAuth-free, uncapped, and return title/artist/album/artwork/30s preview URL. The provider interface is trivial (`search(query) -> [Track]`) and keeps you unhitched from any single platform forever. Cache every selected track in your own DB (`TrackAsset`) so gameplay never depends on a third party being up.

**App — Next.js (App Router, TypeScript, Tailwind), full-stack.**
With OAuth and spotipy gone, the Python backend lost its reason to exist. Route handlers cover everything: search proxy, game/guess/submission APIs, server-side scoring. One deployable, one language, and the answer-secrecy rule (ownership never sent pre-guess) is enforced in server components/route handlers. SWR polling for freshness; no WebSockets.
*If you want Python for the joy of it:* a FastAPI service owning game logic is a legitimate variant — but it's a want, not a need. Decide at M0-1 and don't revisit.

**Identity — Better Auth (email + password), no OAuth.**
A proper signup: email, password, display name — a real account, not a device cookie, so streaks survive a lost phone or a browser reinstall. Sessions last ~1 year and refresh on activity, so the daily open is cookie-only in practice. No SMTP dependency for login; the app sends no mail unless/until password reset is added later.

**Database — Postgres 16** with Drizzle (or Prisma) + migrations. SQLite would honestly suffice, but you run Postgres everywhere already — consistency beats minimalism in a homelab.

**Object storage — RustFS, for user-uploaded profile pictures.**
S3-compatible, self-hosted, one more container. Uploaded avatars live in RustFS (bucket per env); the dicebear-generated seed avatar remains the default so upload is optional, not required at signup.

**Scheduling — one cron job.** The daily draw at 00:00 Adelaide: a cron sidecar container (or systemd timer on the host) curling an internal, token-protected `/api/internal/draw` endpoint. Idempotent by design (unique constraint on `round.date` per game) so double-fires are harmless.

**Infra — what you already run:**
- Docker Compose: `app` (Next.js), `db` (Postgres), `rustfs` (profile picture storage), `cron` (alpine + curl), optional `ntfy`
- Pangolin/Traefik tunnel fronts `song.roddickshare.space`
- ntfy topics: `song-pool-dry`, `song-draw-failed`, `song-new-member`
- Nightly `pg_dump` to the existing backup target

---

## 4. Data model

- **User** — id, display name, email, password hash, avatar seed, avatar_url (nullable, RustFS object key when uploaded). Better Auth tables for sessions/accounts.
- **Game** — id, name, owner_id, created_at, status, settings JSON (scoring weights, reveal policy).
- **GameMember** — game_id, user_id, joined_at, role, status (active/left).
- **InviteLink** — uuid, game_id, created_by, expires_at (+24h), used_count, revoked_at.
- **TrackAsset** — provider (`itunes`/`deezer`), provider_track_id, title, artists, album, artwork_url, preview_url, cached_at. Unique on (provider, provider_track_id).
- **Submission** — game_id, member_id, track_id, submitted_at, status (`pooled`/`played`/`retired`), played_in_round_id (nullable). Unique (game_id, track_id) enforces the duplicate rule.
- **Round** — game_id, round_date (unique per game), submission_id (the answer — never serialized pre-guess), status (open/closed), created_at.
- **Guess** — round_id, guesser_user_id, guessed_member_id, is_correct, points, created_at. Unique (round_id, guesser).
- **StatSnapshot** — per (game, user): current streak, best streak, correct/total, fool points earned; denormalised for cheap leaderboards.

**Draw algorithm:** at 00:00, per active game — candidates = active members with ≥1 pooled submission; if empty → skip + alert; else pick member (uniform, seeded by hash(game_id + date) for reproducibility), pick one of their pooled submissions (uniform, same seed), create Round, flip submission to `played`. All in one transaction; unique (game_id, round_date) makes retries safe.

**Answer secrecy:** the round payload sent to guessers contains track metadata + preview only. Ownership exists solely on `Round.submission_id → Submission.member_id` and is only joined into responses after the caller's Guess row exists (or the round is closed). The submitter's payload instead shows a live "who's guessed / who you've fooled" view.

---

## 5. Milestones & tickets

### M0 — Foundations (weekend 1)
- **M0-1 Stack decision + repo** — lock Next.js-only vs FastAPI variant; scaffold; README. *AC: decision recorded in /docs/adr-001; `docker compose up` serves hello-world.*
- **M0-2 Compose stack** — app, postgres, rustfs, cron, ntfy; healthchecks; env templating. *AC: green on the homelab.*
- **M0-3 Domain + routing** — through existing tunnel; HTTPS externally. *AC: reachable from mobile data.*
- **M0-4 CI + migrations** — lint/typecheck/test on PR; migration tool wired with baseline. *AC: red PR on lint fail; `migrate` idempotent.*

### M1 — Identity (weekend 1–2, it's small now)
- **M1-1 Signup/login** — Better Auth email+password, ~1-year sessions refreshed on activity. *AC: sign up on a phone with email/password/name; session survives browser restart and re-opening weeks later.*
- **M1-2 Profile basics** — display name (captured at signup, editable after), generated avatar (dicebear-style) by default with optional upload to RustFS. *AC: name/avatar editable and shown everywhere a member appears; uploaded picture persists across restarts.*
- **M1-3 Session middleware** — all game routes authed; internal cron endpoint token-protected. *AC: anonymous API call 401; cron endpoint rejects missing token.*

### M2 — Music search & TrackAsset (weekend 2)
- **M2-1 MusicProvider interface + iTunes impl** — `search(query)` normalised to internal Track shape; server-side proxy route (never call Apple from the browser). *AC: search "the presets" returns art + working 30s previews.*
- **M2-2 Deezer fallback impl** — same interface; provider chosen by config/health. *AC: flipping an env var swaps providers with zero code change.*
- **M2-3 TrackAsset caching** — selecting a search result upserts the asset; gameplay reads only from cache. *AC: kill outbound internet, existing rounds still fully render and play.*
- **M2-4 Search UX** — debounced search box, result cards with preview-play button. *AC: find and pick a song in <15s on mobile.*

### M3 — Games, invites, join-with-a-song (weekend 3)
- **M3-1 Create game** — owner becomes member; must attach first submission during creation. *AC: game exists with a one-song pool.*
- **M3-2 Invite links** — 24h expiry, revoke/regenerate, used_count. *AC: expired link shows "ask for a fresh link" page.*
- **M3-3 Join flow** — link → auth (if needed) → pick display name → **submit first song** → member. *AC: cold join on a phone, including song pick, under two minutes.*
- **M3-4 Duplicate rule** — reject already-pooled/played tracks at submission with friendly copy. *AC: second submission of the same track fails gracefully.*
- **M3-5 Game home (pre-round)** — members, own pooled songs (private to you), "first round at midnight" state. *AC: you can see your banked songs; you cannot see anyone else's.*

### M4 — Round engine (weekend 4)
- **M4-1 Draw job** — algorithm per §4, cron-triggered, transactional, idempotent; skip+alert on dry pool. *AC: double-firing the endpoint creates exactly one round; dry pool pings ntfy.*
- **M4-2 Guess API** — one guess per member per round, server-scored; ownership absent from all pre-guess payloads. *AC: network-tab audit shows no ownership leak before guessing.*
- **M4-3 Submitter experience** — drawn member sees "your song is up" + live fooled-count instead of a guess UI; fool points accrue per wrong guess. *AC: wrong guess by A immediately reflects in submitter's view and StatSnapshot.*
- **M4-4 Round lifecycle + streaks** — close at midnight, mark misses, update streaks (submitter days count as played). *AC: three consecutive played days = streak 3; a miss resets; submitter day doesn't break it.*
- **M4-5 Post-guess submission gate** — the "add tomorrow's song" flow unlocks only after your guess (or automatically on your submitter day). *AC: submission endpoint 403s before guessing, 200s after.*
- **M4-6 Ops runbook** — regenerate failed round, force-close, recompute stats; documented. *AC: /docs/runbook.md exists and each command tested once.*

### M5 — Play experience (weekend 5)
- **M5-1 Daily play screen** — art + preview player + "whose song is this?" member picker; one tap to lock in. *AC: playable one-handed; preview plays on iOS Safari (test the autoplay rules).*
- **M5-2 Reveal screen** — verdict, the answer, points, then the submit-for-tomorrow search box inline. *AC: guess → reveal → submitted, all one flow, no dead ends.*
- **M5-3 Share grid** — spoiler-free emoji result + streak to clipboard. *AC: pasted into a group chat, looks right, spoils nothing.*
- **M5-4 Leaderboard** — daily/weekly/all-time; columns for points, accuracy, fool points, streak. *AC: totals reconcile against Guess table.*
- **M5-5 History** — past rounds read-only with answers and per-round guess breakdowns. *AC: yesterday browsable, accepts no input.*

### M6 — Polish & ongoing
- **M6-1 Daily ping** — "today's song is live" via ntfy/web push, opt-in; special copy on your submitter day ("your song is playing 👀"). *AC: per-user opt-in respected.*
- **M6-2 Flavour stats** — most-fooled pairs, "X's songs get mistaken for Y", hardest song so far. *AC: shown on reveal/leaderboard without new schema.*
- **M6-3 Second mode (validates the engine)** — e.g. weekly bonus round: guess the *year* of a played track. *AC: shipped without breaking Round/Guess schema.*
- **M6-4 Ops hardening** — backup restore drill, Grafana panel (rounds, guesses/day, dry-pool events), dependency updates. *AC: restore performed once, documented.*
- **M6-5 Multi-game QoL** — a user in several games gets one combined daily view. *AC: all pending rounds playable from one screen.*

---

## 6. Decisions locked

1. No third-party accounts, ever. Music metadata via keyless APIs behind `MusicProvider`.
2. Better Auth email+password identity; ~1-year sessions; streak durability is a product feature.
3. Joining requires a song. Playing gates submitting. The pool cannot outrun the players.
4. Two-stage uniform draw; played songs retire; duplicates rejected.
5. Submitter scores by fooling; their day is the best day, not a bye.
6. Midnight Adelaide, hard-coded. Reveal after own guess. Spoiler-free share grid.
7. Answers never serialized pre-guess. Scoring server-side only.
8. Single Next.js deployable + cron sidecar (unless ADR-001 says otherwise). No queues, no WebSockets, until measured pain.


## 7. Stretch Goals

1. Users can be a part of more than one game - home game, office game, friend group 1 game, friend group 2 game

## 8. Risks (now pleasantly boring)

- **iTunes/Deezer preview coverage:** some tracks lack previews. Mitigation: metadata-only rounds still work; show "no preview" gracefully; provider fallback (M2-2).
- **Forgotten passwords:** no email flow exists yet to recover a lost password. Mitigation: sessions are ~1 year so re-login is rare; add a password-reset email path if it becomes a real pain point.
- **Small groups:** 2-player games are trivial to guess. Mitigation: UI nudge at <3 members; fool-points still make it playable.
- **Pool droughts:** if people miss days, tomorrow may have no song. Mitigation: rollover pools, dry-pool alert, and the join-submission floor. Scarcity is also motivation — "we need you back, the pool's empty" is a group-chat message that writes itself.