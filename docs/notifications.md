# Invite notifications

Inviting someone into a game is in-app and by display name — there is no
shareable join link.

**The toast is the primary surface.** It carries Accept and Decline, so the
whole flow is one tap without opening anything. The bell exists for invites you
missed — arrived while you were away, or you dismissed the toast. Both render
from the same `useInvites` hook and share one `respond()`, so they can't drift.

## Why Realtime carries no data

Supabase Realtime scopes subscriptions with RLS and `auth.uid()`, which comes
from a **Supabase Auth** JWT. We authenticate with **Better Auth**, so the
browser holds no such token — only the public publishable key. A client-side filter
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
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | the publishable key (`sb_publishable_…`) — Project Settings → API Keys |
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

## Membership rules

- **Remove** is owner-only; **leave** is self-only. Both are the same endpoint
  (`DELETE /api/games/[id]/members/[memberId]`) because the rule is one
  sentence: you may remove yourself, or anyone if you own the game.
- **The owner can't be removed or leave.** They have to hand the game over
  first, which keeps every game owned by exactly one active member.
- **Transfer** (`PATCH /api/games/[id]/owner`) swaps `game.ownerId` and both
  `game_member.role` rows in one transaction, so there's no window where a game
  is ownerless or double-owned.
- **Delete** (`DELETE /api/games/[id]`) requires the game's name in the request
  body and is checked server-side — the dialog's typed confirmation is not just
  a client-side speed bump. Members and invites go via `ON DELETE CASCADE`.
- Removal is soft (`status: left`). Past rounds keep pointing at a real member
  row, and pooled songs retire with the person per GamePlan §2.
