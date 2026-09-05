import { and, eq, gte, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankSong } from "@/lib/db/bank";
import { gameMember } from "@/lib/db/game";
import { guess, round, statSnapshot } from "@/lib/db/round";
import { user } from "@/lib/db/schema";
import { FOOL_POINTS } from "@/lib/game-rules";
import { gameDate, previousDate } from "@/lib/round-date";
import { unsettledRoundIds } from "@/lib/settled-rounds";

export type LeaderboardPeriod = "day" | "week" | "all";

export type LeaderboardRow = {
	memberId: string;
	name: string;
	image: string | null;
	points: number;
	guessPoints: number;
	foolPoints: number;
	correct: number;
	total: number;
	currentStreak: number;
};

function weekStart(date: string) {
	const at = new Date(`${date}T12:00:00Z`);
	const daysSinceMonday = (at.getUTCDay() + 6) % 7;
	let start = date;
	for (let i = 0; i < daysSinceMonday; i += 1) start = previousDate(start);
	return start;
}

export function periodStart(period: LeaderboardPeriod) {
	if (period === "all") return null;
	const today = gameDate();
	return period === "day" ? today : weekStart(today);
}

/** Scores are calculated from the immutable round/guess ledger, never from a
 * cross-game aggregate. A leaderboard therefore belongs to exactly one game. */
export async function leaderboardForGame(
	gameId: string,
	period: LeaderboardPeriod,
): Promise<LeaderboardRow[]> {
	const [members, snapshots, unsettled] = await Promise.all([
		db
			.select({
				memberId: gameMember.id,
				userId: user.id,
				name: user.name,
				image: user.image,
			})
			.from(gameMember)
			.innerJoin(user, eq(gameMember.userId, user.id))
			.where(
				and(eq(gameMember.gameId, gameId), eq(gameMember.status, "active")),
			),
		db.select().from(statSnapshot).where(eq(statSnapshot.gameId, gameId)),
		unsettledRoundIds(gameId),
	]);

	const rows = new Map(
		members.map((member) => [
			member.userId,
			{
				memberId: member.memberId,
				name: member.name,
				image: member.image,
				points: 0,
				guessPoints: 0,
				foolPoints: 0,
				correct: 0,
				total: 0,
				currentStreak: 0,
			},
		]),
	);

	for (const snapshot of snapshots) {
		const row = rows.get(snapshot.userId);
		if (row) row.currentStreak = snapshot.currentStreak;
	}

	const start = periodStart(period);
	const guesses = await db
		.select({
			guesserUserId: guess.guesserUserId,
			isCorrect: guess.isCorrect,
			points: guess.points,
			submitterUserId: bankSong.userId,
		})
		.from(guess)
		.innerJoin(round, eq(guess.roundId, round.id))
		.innerJoin(bankSong, eq(round.bankSongId, bankSong.id))
		.where(
			and(
				eq(round.gameId, gameId),
				start ? gte(round.roundDate, start) : undefined,
				// Excluded from *every* period, not just "day". Fool points accrue
				// the instant someone guesses wrong, so a live round would push the
				// submitter up the weekly and all-time boards too — naming them just
				// as loudly, and for the rest of the week.
				unsettled.length > 0 ? notInArray(round.id, unsettled) : undefined,
			),
		);

	for (const entry of guesses) {
		const guesser = rows.get(entry.guesserUserId);
		if (guesser) {
			guesser.total += 1;
			guesser.correct += Number(entry.isCorrect);
			guesser.guessPoints += entry.points;
			guesser.points += entry.points;
		}
		if (!entry.isCorrect) {
			const submitter = rows.get(entry.submitterUserId);
			if (submitter) {
				submitter.foolPoints += FOOL_POINTS;
				submitter.points += FOOL_POINTS;
			}
		}
	}

	return [...rows.values()].sort(
		(a, b) =>
			b.points - a.points ||
			b.correct - a.correct ||
			a.name.localeCompare(b.name),
	);
}
