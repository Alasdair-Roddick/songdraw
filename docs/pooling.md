# The song bank

Each **person** has one bank of songs, shared by every room they're in. The draw
picks a member first, then one of *their* banked songs the room hasn't played —
so bank size never changes your daily odds, it only changes the variety when
your number comes up.

## Why the bank isn't per-room

"Already played" is a fact about a **room**, not about a song. A track Room A
drew is still completely unheard by Room B, so it stays drawable there. That's
why `bank_song` carries no status column at all: which rooms have burned a song
is derived from `round.bank_song_id`, and the draw excludes only the rows that
*this* room's rounds already used.

The upshot is you maintain one list instead of one per room, and a good song
earns its keep across all of them.

## Privacy

Your bank is private by construction: `GET /api/bank` filters on your own user
id and nothing else reads another person's rows. This is where answer secrecy
starts, and the cheapest place to get it right — there's no filtering step to
forget, because the other rows are never fetched.

## Banking is gated on playing

You can bank once you have **no outstanding guesses** — no room is still waiting
on you today. One bank feeds every room, so the old per-room gate no longer
makes sense; this is the shared-bank version of M4-5, and it lines up exactly
with the "all songs guessed" moment the home feed builds toward. Your own
submitter day doesn't count against you.

`outstandingGuesses()` in `app/api/bank/route.ts` is the single definition, used
both to gate the POST and to render the locked state.

## Removing

You can remove a banked song until some room has played it. After that the round
row points at it and it belongs to that room's history, so the delete is refused.
