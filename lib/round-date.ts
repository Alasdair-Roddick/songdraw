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

const partsFormatter = new Intl.DateTimeFormat("en-CA", {
	timeZone: GAME_TIMEZONE,
	hour12: false,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
});

function zonedParts(at: Date) {
	const parts: Record<string, string> = {};
	for (const part of partsFormatter.formatToParts(at)) {
		if (part.type !== "literal") parts[part.type] = part.value;
	}
	return parts;
}

/**
 * Has this round's answer unlocked on the clock? True once it is past
 * REVEAL_HOUR in Adelaide on the round's own date, or any day after it.
 *
 * Compared as calendar-date + hour in the target zone rather than as UTC
 * instants, so DST is handled by Intl instead of by arithmetic here.
 */
export function isPastRevealHour(
	roundDate: string,
	revealHour: number,
	at: Date = new Date(),
): boolean {
	const parts = zonedParts(at);
	const date = `${parts.year}-${parts.month}-${parts.day}`;
	if (date > roundDate) return true;
	if (date < roundDate) return false;
	return Number(parts.hour) >= revealHour;
}

/** The instant REVEAL_HOUR falls on `roundDate`, for client-side countdowns. */
export function revealInstant(roundDate: string, revealHour: number): Date {
	const hh = String(revealHour).padStart(2, "0");
	// Treat the wall-clock time as UTC first, then subtract the zone's offset
	// at that moment. Adelaide's DST switches happen at ~02:00-03:00, so an
	// evening reveal hour is never inside the ambiguous window.
	const asIfUtc = new Date(`${roundDate}T${hh}:00:00Z`);
	const parts = zonedParts(asIfUtc);
	const localAsUtc = Date.UTC(
		Number(parts.year),
		Number(parts.month) - 1,
		Number(parts.day),
		Number(parts.hour),
		Number(parts.minute),
		Number(parts.second),
	);
	return new Date(asIfUtc.getTime() - (localAsUtc - asIfUtc.getTime()));
}

/** The calendar day before `date` (YYYY-MM-DD in, YYYY-MM-DD out). */
export function previousDate(date: string): string {
	// Anchored at noon UTC so a ±1 day shift can't be swallowed by DST when
	// Adelaide's clocks move.
	const at = new Date(`${date}T12:00:00Z`);
	at.setUTCDate(at.getUTCDate() - 1);
	return at.toISOString().slice(0, 10);
}
