import {
	and,
	count,
	countDistinct,
	desc,
	eq,
	notInArray,
	sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { bankSong } from "@/lib/db/bank";
import { gameMember } from "@/lib/db/game";
import { guess, round } from "@/lib/db/round";
import { user } from "@/lib/db/schema";
import { trackAsset } from "@/lib/db/track-asset";
import { unsettledRoundIds } from "@/lib/settled-rounds";

// Below this, "lore" is just the last round with names on it.
const MIN_ROUNDS_FOR_LORE = 2;

export type GameInsights = {
	mostFooledPair: { submitter: string; guessed: string; times: number } | null;
	hardestSong: {
		title: string;
		artist: string;
		correct: number;
		total: number;
	} | null;
};

/**
 * Low-stakes summaries derived from *settled* guesses, scoped to one game.
 *
 * "Settled" is load-bearing. Both of these name people and songs, so a live
 * round in the pool turns the lore into a running commentary on today's answer:
 * every wrong guess pushes today's submitter up "most often mistaken for", and
 * today's track straight into "hardest so far".
 */
export async function gameInsights(gameId: string): Promise<GameInsights> {
	const unsettled = await unsettledRoundIds(gameId);
	const settledOnly =
		unsettled.length > 0 ? notInArray(round.id, unsettled) : undefined;

	// A room needs a past before it has lore. With a single settled round every
	// line here is just that round restated with names attached, which reads as
	// a spoiler even when the answer is already public — and if that round is
	// also the live one's only company, it invites exactly the wrong inference.
	const [{ settledRounds }] = await db
		.select({ settledRounds: countDistinct(round.id) })
		.from(round)
		.innerJoin(guess, eq(guess.roundId, round.id))
		.where(and(eq(round.gameId, gameId), settledOnly));

	if (settledRounds < MIN_ROUNDS_FOR_LORE) {
		return { mostFooledPair: null, hardestSong: null };
	}

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
		.where(
			and(eq(round.gameId, gameId), eq(guess.isCorrect, false), settledOnly),
		)
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
		.where(and(eq(round.gameId, gameId), settledOnly))
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
