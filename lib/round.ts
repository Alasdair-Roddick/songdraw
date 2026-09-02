import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { gameMember } from "@/lib/db/game";
import { guess, round } from "@/lib/db/round";
import { user } from "@/lib/db/schema";
import { submission } from "@/lib/db/submission";
import { trackAsset } from "@/lib/db/track-asset";
import { gameDate } from "@/lib/round-date";

export type RoundView =
	| { state: "none" }
	// You submitted today's song: no guess UI, a live fooled-count instead.
	| {
			state: "submitter";
			roundId: string;
			track: TrackView;
			guesses: { name: string; image: string | null; correct: boolean }[];
			fooled: number;
	  }
	// Pre-guess. Deliberately carries no ownership of any kind.
	| { state: "guessing"; roundId: string; track: TrackView }
	// Post-guess (or closed round): the answer is now yours to see.
	| {
			state: "revealed";
			roundId: string;
			track: TrackView;
			correct: boolean;
			points: number;
			answer: { memberId: string; name: string; image: string | null };
			guessed: { memberId: string; name: string } | null;
	  };

type TrackView = {
	title: string;
	artist: string;
	album: string | null;
	artworkUrl: string | null;
	previewUrl: string | null;
};

/**
 * Builds the round payload for one viewer.
 *
 * This is the single place answer secrecy is enforced (GamePlan §4). The
 * ownership join only ever happens on a branch the caller has earned — they
 * submitted the song, they've already guessed, or the round is closed — so
 * there is no code path that serializes the answer to someone still guessing.
 */
export async function roundViewFor(
	gameId: string,
	viewerUserId: string,
	viewerMemberId: string,
): Promise<RoundView> {
	const [today] = await db
		.select({
			id: round.id,
			status: round.status,
			submitterMemberId: submission.memberId,
			track: {
				title: trackAsset.title,
				artist: trackAsset.artist,
				album: trackAsset.album,
				artworkUrl: trackAsset.artworkUrl,
				previewUrl: trackAsset.previewUrl,
			},
		})
		.from(round)
		.innerJoin(submission, eq(round.submissionId, submission.id))
		.innerJoin(trackAsset, eq(submission.trackId, trackAsset.id))
		.where(and(eq(round.gameId, gameId), eq(round.roundDate, gameDate())))
		.limit(1);

	if (!today) return { state: "none" };

	// Your own song is up: you don't guess, you watch who you fooled.
	if (today.submitterMemberId === viewerMemberId) {
		const rows = await db
			.select({
				name: user.name,
				image: user.image,
				correct: guess.isCorrect,
			})
			.from(guess)
			.innerJoin(user, eq(guess.guesserUserId, user.id))
			.where(eq(guess.roundId, today.id));

		return {
			state: "submitter",
			roundId: today.id,
			track: today.track,
			guesses: rows,
			fooled: rows.filter((row) => !row.correct).length,
		};
	}

	const [mine] = await db
		.select({
			isCorrect: guess.isCorrect,
			points: guess.points,
			guessedMemberId: guess.guessedMemberId,
		})
		.from(guess)
		.where(
			and(eq(guess.roundId, today.id), eq(guess.guesserUserId, viewerUserId)),
		)
		.limit(1);

	if (!mine && today.status === "open") {
		return { state: "guessing", roundId: today.id, track: today.track };
	}

	// Earned the answer: either they guessed, or the round has closed.
	const [answer] = await db
		.select({
			memberId: gameMember.id,
			name: user.name,
			image: user.image,
		})
		.from(gameMember)
		.innerJoin(user, eq(gameMember.userId, user.id))
		.where(eq(gameMember.id, today.submitterMemberId))
		.limit(1);

	let guessed: { memberId: string; name: string } | null = null;
	if (mine) {
		const [row] = await db
			.select({ memberId: gameMember.id, name: user.name })
			.from(gameMember)
			.innerJoin(user, eq(gameMember.userId, user.id))
			.where(eq(gameMember.id, mine.guessedMemberId))
			.limit(1);
		guessed = row ?? null;
	}

	return {
		state: "revealed",
		roundId: today.id,
		track: today.track,
		correct: mine?.isCorrect ?? false,
		points: mine?.points ?? 0,
		answer,
		guessed,
	};
}
