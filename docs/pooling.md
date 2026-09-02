# Banking songs (the pool)

Each member banks songs into a game's pool. On any given day the draw picks a
member first, then one of *their* pooled songs (GamePlan §2), so pool size
doesn't change your daily odds — a big pool just means more variety when your
number comes up.

## Privacy

Your pool is private, and it's private *by construction*: the game page only
ever queries `submission` rows scoped to your own `game_member.id`
([app/game/[id]/page.tsx](../app/game/[id]/page.tsx)), and there is no endpoint
that returns anyone else's. This is the first place the answer-secrecy rule
(GamePlan §4) bites, and the cheapest place to get it right — there's no
filtering step to forget, because the other rows are never fetched.

## The duplicate rule

GamePlan §2 and M3-4 disagree: §2 says a track pooled *or* played in the game
can't be submitted again (unique on `game_id, track_id`), while M3-4 later
argues duplicates should be per-user, because a pooled-but-unplayed song has
been seen by nobody except the person who banked it.

M3-4 wins here, and the constraint is `unique (game_id, member_id, track_id)`:

- **Re-banking a track you already hold** → rejected. It's a wasted slot; you
  gain nothing from holding the same song twice.
- **Banking a track someone else has pooled** → allowed. Nobody has seen it, so
  there's no information leak — and two people independently banking the same
  song is a genuinely funny reveal when it's finally drawn.
- **Banking a track this game has already played** → rejected. Everyone saw it
  and knows whose it was, so it has no bluffing value left.

That last rejection expires. `REPLAY_AFTER_DAYS` in
[lib/game-rules.ts](../lib/game-rules.ts) (currently 180) is how long a played
track stays off-limits, per M3-4's "after some time they can play the same song
again".

## Lifecycle

`pooled → played → retired`.

- **pooled** — banked and waiting. Only you can see it; only you can remove it.
- **played** — drawn for a round. Removal is refused from here on: it's part of
  the game's history, not your inventory any more.
- **retired** — the member left or was removed. Retiring their still-pooled
  songs happens in the same transaction as the removal
  ([members route](../app/api/games/[id]/members/[memberId]/route.ts)), so a
  departed player's pool can never be drawn. Already-played songs are left
  alone — those rounds happened.

## Gating

Submission is closed entirely below `MIN_MEMBERS` (3), checked server-side on
every POST, not just hidden in the UI. After rounds begin, M4-5 adds the second
gate: you must have guessed today before you may bank again.
