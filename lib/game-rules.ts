// GamePlan.md §2: submission — and therefore the whole daily loop — is locked
// until a game has this many active members.
export const MIN_MEMBERS = 3;

/** Room names are rendered as a page heading; long enough to be expressive,
 * short enough not to break the layout or the invite list. */
export const MAX_GAME_NAME = 60;

// Stable identities for the seat meter, so the fixed-length row doesn't need
// array indices as React keys.
export const SEATS = ["first", "second", "third"] as const;

// A played song leaves your bank for good. You may re-bank the same *track*
// once this many rounds have been drawn in the game that played it — long
// enough that nobody remembers it was yours.
export const REPLAY_AFTER_ROUNDS = 5;

// Scoring v1 (GamePlan §2). A correct guess is worth twice what fooling one
// person is, so guessing well and bluffing well are both viable.
export const CORRECT_POINTS = 100;
export const FOOL_POINTS = 50;

// Bonus round: ~30% of rounds get a trivia question when the track has metadata.
export const BONUS_CHANCE = 0.3;
export const BONUS_EXACT_POINTS = 50;
export const BONUS_CLOSE_POINTS = 25;

// Answers unlock at 17:00 Australia/Adelaide — or as soon as everyone has
// guessed, whichever comes first. Guessing early no longer spoils the answer
// for you, so the reveal is something the group arrives at together.
//
// This is also the guessing deadline: once the answer is out, a guess would be
// worthless, so the API refuses it.
export const REVEAL_HOUR = 17;

/**
 * The effective reveal hour.
 *
 * Outside production the clock deadline is off by default (24 = never), because
 * otherwise any dev session after 5pm local finds every round pre-revealed and
 * the guess flow untestable. Reveal-on-everyone-guessed still works, so the
 * mechanic is fully exercisable — only the wall-clock cutoff is suspended.
 *
 * Set DEV_REVEAL_HOUR to test the deadline itself (e.g. 17 for real behaviour,
 * or 0 to force everything revealed). Production always uses REVEAL_HOUR.
 */
export function revealHour() {
	if (process.env.NODE_ENV === "production") return REVEAL_HOUR;

	const override = Number(process.env.DEV_REVEAL_HOUR);
	if (Number.isInteger(override) && override >= 0 && override <= 24) {
		return override;
	}
	return 24;
}
