# Feature requests

A player writes a feature request in the game; the game signs it and POSTs it
to the admin console, which owns it from that moment on. **Nothing about a
feature request is stored in this database** — no table, no migration.

## Why it is posted rather than stored

The console reads this database through `songdraw_admin_ro`, which runs with
`default_transaction_read_only = on`. Triage is nothing but writes — a status
change, an internal note, a record of what the submitter was told — so a table
here would mean routing every triage click back through the signed
`/api/internal/admin/*` path and adding mutations to a surface deliberately
capped at four, for a feature this game has no rules about.

So the direction is inverted. The submitter's name and email are **copied at
ingest, not referenced**: the two databases never meet, the reply goes to the
address that asked, and a two-year-old request reads as it did when it was
written. A closed account leaves the request intact and its address unusable,
which is correct.

## The pieces here

| File | What it is |
|---|---|
| [lib/feature-request.ts](../lib/feature-request.ts) | Signs and posts. The sign half of the envelope `lib/admin-contract.ts` verifies. |
| [app/api/feature-request/route.ts](../app/api/feature-request/route.ts) | The player-facing route: session, validation, rate limit. |
| [components/feature-request-form.tsx](../components/feature-request-form.tsx) | The form. |
| [app/feature-request/page.tsx](../app/feature-request/page.tsx) | The page, reached from the avatar menu. |

## The envelope

`POST https://<ADMIN_INGEST_URL>/api/ingest/feature-request`, with:

| Header | Value |
|---|---|
| `x-songdraw-timestamp` | Unix seconds, decimal string |
| `x-songdraw-nonce` | `randomBytes(16).toString("hex")`, fresh per attempt |
| `x-songdraw-actor` | The submitter's user id, or `anonymous` |
| `x-songdraw-signature` | Hex HMAC-SHA256 over the canonical string |

The canonical string is seven fields joined by `\n`, no trailing newline:

```
v1 / POST / /api/ingest/feature-request / <timestamp> / <nonce> / <actor> / <sha256 hex of the body bytes>
```

Two things differ from `docs/admin-write-api.md`, both the console's choice:
the signature travels as **bare hex**, not `v1=<hex>`, and the secret is
`INGEST_SHARED_SECRET`, not `ADMIN_API_TOKEN`.

**Hash the bytes you send, not the object you have.** `fileFeatureRequest`
serialises once and both hashes and transmits that same string; two JSON
encoders that disagree about key order or unicode escaping would otherwise
produce a valid signature over a body the console never saw. Method and path
are signed so a captured request cannot be replayed against another endpoint.

No field may contain a newline — it would forge the canonical string's field
boundaries. Only the actor is data rather than something we mint, so that is
the one that is checked.

## What the console answers

| Status | Meaning | What the player sees |
|---|---|---|
| `201` | Filed; the acknowledgement email has gone out | "Thanks — check your email." |
| `200` | `duplicate: true`; a retry, nothing was sent again | "You've already sent this one." |
| `401` / `409` / `413` / `422` | Rejected | "We couldn't file that just now." (502 from us; reason logged) |
| `503` | The console is misconfigured — **retry** | "The request desk is down — try again shortly." (503 from us) |
| *no answer* | It may well have been filed | "It may have gone through — check your email before sending it again." (504 from us) |

A timeout is **not** a refusal, and is never retried under a fresh
`externalId`: that files a second copy.

## Idempotency

`externalId` is unique on the console, so a retry inserts nothing, sends
nothing, and returns the original id. The form mints a `clientKey` once per
request and reuses it on every retry of that request, rolling it only after one
is safely filed. The route does **not** trust that key as the id — it derives
`fr_<sha256(user id, client key)>` via `externalIdFor`, so one player cannot
choose an id that collides with another player's request and have theirs
swallowed as a duplicate.

## Guards

- **Session required.** Name and email come from `session.user`, never the
  body — a body-supplied address would make this an open relay for the
  console's sending domain.
- **Five per person per hour**, per process. Every filed request sends an
  acknowledgement email from the console's domain.
- **https outside loopback.** The signature protects the body, not the
  transport, and the body carries a real person's email address.
- **Boot-time checks** in `instrumentation.ts` and `app-entrypoint.sh`:
  `INGEST_SHARED_SECRET` must be a non-placeholder secret of at least 32
  characters and must differ from both `CRON_TOKEN` and `ADMIN_API_TOKEN`, and
  `ADMIN_INGEST_URL` must parse and be https.

## Configuration

```bash
ADMIN_INGEST_URL=https://songdraw.rddk.dev
INGEST_SHARED_SECRET=<the same value as the console; openssl rand -hex 32>
```

Unset either one and the form answers 503 and files nothing. Set them on Fly
with `fly secrets set`.
