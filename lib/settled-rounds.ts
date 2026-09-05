import { and, count, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankSong } from "@/lib/db/bank";
import { gameMember } from "@/lib/db/game";
import { guess, round } from "@/lib/db/round";
import { revealHour } from "@/lib/game-rules";
import { gameDate, isPastRevealHour } from "@/lib/round-date";

/**
 * Rounds whose answer is still secret from at least one member.
 *
 * Every aggregate built on the guess ledger has to exclude these, because
 * scoring is written the moment someone guesses. A live round therefore moves
 * the submitter's fool points and their name through any leaderboard or lore
 * that reads those guesses — which is the answer, published in a side channel,
 * before anyone was meant to see it.
 *
 * Deliberately the same three conditions lib/round.ts uses to unlock a reveal,
 * so no surface can consider a round settled while another still hides it.
 */
export async function unsettledRounds(
	gameId: string,
): Promise<{ id: string; roundDate: string }[]> {
	const open = await db
		.select({
			id: round.id,
			roundDate: round.roundDate,
			submitterUserId: bankSong.userId,
		})
		.from(round)
		.innerJoin(bankSong, eq(round.bankSongId, bankSong.id))
		.where(and(eq(round.gameId, gameId), eq(round.status, "open")));

	if (open.length === 0) return [];

	const hour = revealHour();
	const pending = open.filter(
		(entry) => !isPastRevealHour(entry.roundDate, hour),
	);
	if (pending.length === 0) return [];

	// A round also settles early once every eligible member has guessed —
	// everyone has seen the answer by then, so withholding it helps nobody.
	const unsettled: { id: string; roundDate: string }[] = [];
	for (const entry of pending) {
		const [[{ eligible }], [{ answered }]] = await Promise.all([
			db
				.select({ eligible: count() })
				.from(gameMember)
				.where(
					and(
						eq(gameMember.gameId, gameId),
						eq(gameMember.status, "active"),
						ne(gameMember.userId, entry.submitterUserId),
					),
				),
			db
				.select({ answered: count() })
				.from(guess)
				.where(eq(guess.roundId, entry.id)),
		]);

		const everyoneIn = eligible > 0 && answered >= eligible;
		if (!everyoneIn) {
			unsettled.push({ id: entry.id, roundDate: entry.roundDate });
		}
	}

	return unsettled;
}

export async function unsettledRoundIds(gameId: string): Promise<string[]> {
	return (await unsettledRounds(gameId)).map((entry) => entry.id);
}

/**
 * Is today's round still hiding its answer from someone? The leaderboard uses
 * this to say so out loud, rather than rendering a board of zeroes that looks
 * like nobody has played.
 */
export async function hasLiveRoundToday(gameId: string): Promise<boolean> {
	const today = gameDate();
	return (await unsettledRounds(gameId)).some(
		(entry) => entry.roundDate === today,
	);
}
