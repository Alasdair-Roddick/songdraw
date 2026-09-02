import { and, count, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { bankSong } from "@/lib/db/bank";
import { gameMember } from "@/lib/db/game";
import { guess, round } from "@/lib/db/round";
import { user } from "@/lib/db/schema";
import { trackAsset } from "@/lib/db/track-asset";

export type GameInsights = {
	mostFooledPair: { submitter: string; guessed: string; times: number } | null;
	hardestSong: {
		title: string;
		artist: string;
		correct: number;
		total: number;
	} | null;
};

/** Low-stakes summaries derived from resolved guesses, scoped to one game. */
export async function gameInsights(gameId: string): Promise<GameInsights> {
	const submitter = alias(user, "insight_submitter");
	const mistakenFor = alias(user, "insight_mistaken_for");
	const [pair] = await db
		.select({
			submitter: submitter.name,
			guessed: mistakenFor.name,
			times: count(),
		})
		.from(guess)
		.innerJoin(round, eq(guess.roundId, round.id))
		.innerJoin(bankSong, eq(round.bankSongId, bankSong.id))
		.innerJoin(submitter, eq(bankSong.userId, submitter.id))
		.innerJoin(gameMember, eq(guess.guessedMemberId, gameMember.id))
		.innerJoin(mistakenFor, eq(gameMember.userId, mistakenFor.id))
		.where(and(eq(round.gameId, gameId), eq(guess.isCorrect, false)))
		.groupBy(submitter.name, mistakenFor.name)
		.orderBy(desc(count()))
		.limit(1);

	const songs = await db
		.select({
			title: trackAsset.title,
			artist: trackAsset.artist,
			correct: sql<number>`count(*) filter (where ${guess.isCorrect})`,
			total: count(),
		})
		.from(guess)
		.innerJoin(round, eq(guess.roundId, round.id))
		.innerJoin(bankSong, eq(round.bankSongId, bankSong.id))
		.innerJoin(trackAsset, eq(bankSong.trackId, trackAsset.id))
		.where(eq(round.gameId, gameId))
		.groupBy(trackAsset.id, trackAsset.title, trackAsset.artist);

	const hardestSong = songs
		.filter((song) => song.total >= 2)
		.sort(
			(a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total,
		)[0];

	return {
		mostFooledPair: pair ?? null,
		hardestSong: hardestSong ?? null,
	};
}
