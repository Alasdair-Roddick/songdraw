# The song bank

Each **person** has one bank of songs, shared by every room they're in. The draw
picks a member first, then one of *their* banked songs the room hasn't played —
so bank size never changes your daily odds, it only changes the variety when
your number comes up.

## A song is spent when it's drawn

The first time any room draws one of your songs, that row flips to `played`,
leaves your bank, and is never drawn again — in that room or any other. The row
itself survives because its round points at it; "removed from the bank" is a
status, not a delete.

So the bank is one list you maintain for every room, and each song in it is a
single shot.

## Re-banking the same track

Because a track can legitimately come back later, there is deliberately **no**
unique `(user_id, track_id)`: you may hold several rows for one track across
time. What the bank route enforces instead is:

- you can't bank a track you're currently holding, and
- you can't re-bank one you had played until `REPLAY_AFTER_ROUNDS` (5) further
  rounds have been drawn in the room that played it.

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

Crucially, a round past its reveal doesn't count either. Guessing closes at the
reveal, so counting those would leave the gate permanently unclearable and lock
you out of banking until midnight — which is exactly the bug that shipped in the
first version of this.

`outstandingGuesses()` in `app/api/bank/route.ts` is the single definition, used
both to gate the POST and to render the locked state.

## Removing

You can remove a song while it's still banked. Once played it has already left
the bank and belongs to a room's history, so the delete matches nothing and is
refused.
