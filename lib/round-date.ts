// GamePlan §2: the day boundary is 00:00 Australia/Adelaide, hard-coded.
// Everything about "which round is today" resolves through here so the answer
// never depends on where the server happens to be running.
export const GAME_TIMEZONE = "Australia/Adelaide";

const formatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: GAME_TIMEZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

/** The current round date in the game's timezone, as YYYY-MM-DD. */
export function gameDate(at: Date = new Date()): string {
	// en-CA formats as YYYY-MM-DD, which is exactly Postgres' date literal.
	return formatter.format(at);
}

/** The calendar day before `date` (YYYY-MM-DD in, YYYY-MM-DD out). */
export function previousDate(date: string): string {
	// Anchored at noon UTC so a ±1 day shift can't be swallowed by DST when
	// Adelaide's clocks move.
	const at = new Date(`${date}T12:00:00Z`);
	at.setUTCDate(at.getUTCDate() - 1);
	return at.toISOString().slice(0, 10);
}
