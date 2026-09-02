// GamePlan.md §2: submission — and therefore the whole daily loop — is locked
// until a game has this many active members.
export const MIN_MEMBERS = 3;

// Stable identities for the seat meter, so the fixed-length row doesn't need
// array indices as React keys.
export const SEATS = ["first", "second", "third"] as const;

// How long a played track is off-limits before someone may bank it again
// (GamePlan M3-4). Long enough that nobody remembers whose it was.
export const REPLAY_AFTER_DAYS = 180;

// Scoring v1 (GamePlan §2). A correct guess is worth twice what fooling one
// person is, so guessing well and bluffing well are both viable.
export const CORRECT_POINTS = 100;
export const FOOL_POINTS = 50;

// Answers unlock at 17:00 Australia/Adelaide — or as soon as everyone has
// guessed, whichever comes first. Guessing early no longer spoils the answer
// for you, so the reveal is something the group arrives at together.
//
// This is also the guessing deadline: once the answer is out, a guess would be
// worthless, so the API refuses it.
export const REVEAL_HOUR = 17;

/**
 * The effective reveal hour. Outside production `DEV_REVEAL_HOUR` can push it
 * later (24 = never on the clock), which is the only way to exercise the guess
 * flow when you're testing after 5pm local.
 */
export function revealHour() {
	if (process.env.NODE_ENV !== "production" && process.env.DEV_REVEAL_HOUR) {
		const hour = Number(process.env.DEV_REVEAL_HOUR);
		if (Number.isInteger(hour) && hour >= 0 && hour <= 24) return hour;
	}
	return REVEAL_HOUR;
}
