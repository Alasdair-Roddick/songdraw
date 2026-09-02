# Invite notifications

Inviting someone into a game is in-app and by display name — there is no
shareable join link. The invitee gets a toast if they're looking at the app, and
a badge on the bell either way.

## Why Realtime carries no data

Supabase Realtime scopes subscriptions with RLS and `auth.uid()`, which comes
from a **Supabase Auth** JWT. We authenticate with **Better Auth**, so the
browser holds no such token — only the public anon key. A client-side filter
like `invitee_id=eq.<myId>` is therefore unenforced: anyone could subscribe to
anyone's invites.

So Realtime is a doorbell, not a delivery:

1. Every user has a channel named `user-<HMAC-SHA256(userId, REALTIME_CHANNEL_SECRET)>`,
   computed server-side in `lib/realtime.ts` and handed to the browser from
   their own authed session (`components/app-header.tsx`). Knowing someone's
   user id doesn't let you guess their channel.
2. The server broadcasts an **empty payload** to that channel via Realtime's
   REST endpoint — no socket to manage inside a route handler.
3. The client's only reaction is to revalidate `GET /api/invites`, which is
   Better Auth-authed and returns only the caller's rows.

Nothing sensitive crosses the socket, so even a channel leak exposes the fact
that *something* happened, never what.

## Why polling stays

`hooks/use-invites.ts` keeps a 60s `refreshInterval` and `revalidateOnFocus`.
Realtime is the fast path; polling is the correctness floor. If the socket
drops, the env vars are missing, or the tab slept, the bell still converges —
which is what lets `lib/realtime.ts` treat a failed broadcast as ignorable
rather than as a request failure.

## Setup

Realtime broadcast needs no table configuration — we never use
`postgres_changes`, so there's no publication to enable and no RLS to write.

Set these from Supabase → Project Settings → API:

| Var | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon/publishable key |
| `REALTIME_CHANNEL_SECRET` | any long random string — `openssl rand -hex 32` |

Rotating `REALTIME_CHANNEL_SECRET` re-keys every channel. Clients pick up their
new channel on next page load; until then they fall back to polling. Leaving all
three unset disables Realtime entirely and the app runs on polling alone.

## Data model

`game_invite` — unique on `(game_id, invitee_id)`. Re-inviting someone who
declined flips their existing row back to `pending` (an upsert) rather than
stacking duplicate rows, so a game's invite history stays one-row-per-person.

Status flow: `pending → accepted | declined | cancelled`. Accepting inserts the
`game_member` row in the same transaction; a member who previously left is
flipped back to `active` rather than colliding with the unique constraint.
