import { and, count, eq, lte, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankSong } from "@/lib/db/bank";
import { game, gameMember } from "@/lib/db/game";
import { guess, round, statSnapshot } from "@/lib/db/round";
import { user } from "@/lib/db/schema";
import { trackAsset } from "@/lib/db/track-asset";
import { revealHour } from "@/lib/game-rules";
import {
	gameDate,
	isPastRevealHour,
	previousDate,
	revealInstant,
} from "@/lib/round-date";

export type TrackView = {
	title: string;
	artist: string;
	album: string | null;
	artworkUrl: string | null;
	previewUrl: string | null;
};

export type MemberView = { id: string; name: string; image: string | null };

export type RoundView =
	| { state: "none" }
	| {
			state: "submitter";
			roundId: string;
			track: TrackView;
			guesses: { name: string; image: string | null; correct: boolean }[];
			fooled: number;
			waitingOn: number;
	  }
	// Pre-guess. Deliberately carries no ownership of any kind.
	| { state: "guessing"; roundId: string; track: TrackView }
	// Guessed, but the answer hasn't unlocked yet. Also carries no ownership.
	| {
			state: "locked";
			roundId: string;
			track: TrackView;
			guessed: MemberView;
			waitingOn: number;
			revealAt: string;
	  }
	| {
			state: "revealed";
			roundId: string;
			track: TrackView;
			/** They never guessed — the window closed on them. Not the same as
			 *  guessing wrong, and must not be rendered as a verdict. */
			missed: boolean;
			correct: boolean;
			points: number;
			/** Sequence number is safe after reveal and lets the share card identify
			 * a day without exposing a track or a person's name. */
			roundNumber: number;
			streak: number;
			answer: MemberView;
			guessed: MemberView | null;
	  };

export type FeedEntry = {
	gameId: string;
	gameName: string;
	/** The viewer's own game_member id — the picker must exclude it, and it is
	 *  a different id space from their user id. */
	viewerMemberId: string;
	members: MemberView[];
	round: RoundView;
};

/**
 * Builds the round payload for one viewer.
 *
 * This is the single place answer secrecy is enforced (GamePlan §4). The
 * ownership join only ever happens on a branch the caller has earned, so there
 * is no code path that serializes the answer to someone who shouldn't see it.
 *
 * Since the reveal moved to 17:00-or-everyone-guessed, "earned" now means the
 * whole group is done — guessing early no longer spoils your own day.
 */
export async function roundViewFor(
	gameId: string,
	viewerUserId: string,
): Promise<RoundView> {
	const [today] = await db
		.select({
			id: round.id,
			status: round.status,
			roundDate: round.roundDate,
			submitterUserId: bankSong.userId,
			track: {
				title: trackAsset.title,
				artist: trackAsset.artist,
				album: trackAsset.album,
				artworkUrl: trackAsset.artworkUrl,
				previewUrl: trackAsset.previewUrl,
			},
		})
		.from(round)
		.innerJoin(bankSong, eq(round.bankSongId, bankSong.id))
		.innerJoin(trackAsset, eq(bankSong.trackId, trackAsset.id))
		.where(and(eq(round.gameId, gameId), eq(round.roundDate, gameDate())))
		.limit(1);

	if (!today) return { state: "none" };

	// Everyone active except the submitter is expected to guess.
	const [{ eligible }] = await db
		.select({ eligible: count() })
		.from(gameMember)
		.where(
			and(
				eq(gameMember.gameId, gameId),
				eq(gameMember.status, "active"),
				ne(gameMember.userId, today.submitterUserId),
			),
		);

	const [{ answered }] = await db
		.select({ answered: count() })
		.from(guess)
		.where(eq(guess.roundId, today.id));

	const waitingOn = Math.max(eligible - answered, 0);
	const everyoneIn = eligible > 0 && answered >= eligible;
	const revealed =
		today.status === "closed" ||
		everyoneIn ||
		isPastRevealHour(today.roundDate, revealHour());

	// Your own song is up: you don't guess, you watch who you fooled. The
	// submitter already knows the answer, so there's nothing to withhold.
	if (today.submitterUserId === viewerUserId) {
		const rows = await db
			.select({ name: user.name, image: user.image, correct: guess.isCorrect })
			.from(guess)
			.innerJoin(user, eq(guess.guesserUserId, user.id))
			.where(eq(guess.roundId, today.id));

		return {
			state: "submitter",
			roundId: today.id,
			track: today.track,
			guesses: rows,
			fooled: rows.filter((row) => !row.correct).length,
			waitingOn,
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

	if (!mine && !revealed) {
		return { state: "guessing", roundId: today.id, track: today.track };
	}

	// Locked in, waiting on the group or the clock. Still no ownership here —
	// only the pick they made themselves, which they obviously already know.
	if (mine && !revealed) {
		const [picked] = await db
			.select({ id: gameMember.id, name: user.name, image: user.image })
			.from(gameMember)
			.innerJoin(user, eq(gameMember.userId, user.id))
			.where(eq(gameMember.id, mine.guessedMemberId))
			.limit(1);

		return {
			state: "locked",
			roundId: today.id,
			track: today.track,
			guessed: picked,
			waitingOn,
			revealAt: revealInstant(today.roundDate, revealHour()).toISOString(),
		};
	}

	const [answer] = await db
		.select({ id: gameMember.id, name: user.name, image: user.image })
		.from(gameMember)
		.innerJoin(user, eq(gameMember.userId, user.id))
		.where(
			and(
				eq(gameMember.gameId, gameId),
				eq(gameMember.userId, today.submitterUserId),
			),
		)
		.limit(1);

	let guessed: MemberView | null = null;
	if (mine) {
		const [row] = await db
			.select({ id: gameMember.id, name: user.name, image: user.image })
			.from(gameMember)
			.innerJoin(user, eq(gameMember.userId, user.id))
			.where(eq(gameMember.id, mine.guessedMemberId))
			.limit(1);
		guessed = row ?? null;
	}

	const [[{ roundNumber }], [stats]] = await Promise.all([
		db
			.select({ roundNumber: count() })
			.from(round)
			.where(
				and(eq(round.gameId, gameId), lte(round.roundDate, today.roundDate)),
			),
		db
			.select({
				currentStreak: statSnapshot.currentStreak,
				lastPlayedDate: statSnapshot.lastPlayedDate,
			})
			.from(statSnapshot)
			.where(
				and(
					eq(statSnapshot.gameId, gameId),
					eq(statSnapshot.userId, viewerUserId),
				),
			)
			.limit(1),
	]);

	return {
		state: "revealed",
		roundId: today.id,
		track: today.track,
		missed: !mine,
		correct: mine?.isCorrect ?? false,
		points: mine?.points ?? 0,
		roundNumber,
		// The snapshot settles at the nightly close, but the share grid is shown
		// at reveal. Project today's played day forward so it reads correctly now.
		streak: mine
			? stats?.lastPlayedDate === previousDate(today.roundDate)
				? stats.currentStreak + 1
				: 1
			: 0,
		answer,
		guessed,
	};
}

/**
 * Every game's round for one user, for the scrolling play feed —
 * GamePlan M6-5's "one combined daily view", arriving early because the feed
 * is now the home screen.
 */
export async function feedForUser(userId: string): Promise<FeedEntry[]> {
	const games = await db
		.select({
			gameId: game.id,
			gameName: game.name,
			memberId: gameMember.id,
		})
		.from(gameMember)
		.innerJoin(game, eq(gameMember.gameId, game.id))
		.where(and(eq(gameMember.userId, userId), eq(gameMember.status, "active")));

	const entries = await Promise.all(
		games.map(async ({ gameId, gameName, memberId }) => {
			const [view, members] = await Promise.all([
				roundViewFor(gameId, userId),
				db
					.select({ id: gameMember.id, name: user.name, image: user.image })
					.from(gameMember)
					.innerJoin(user, eq(gameMember.userId, user.id))
					.where(
						and(eq(gameMember.gameId, gameId), eq(gameMember.status, "active")),
					),
			]);
			return {
				gameId,
				gameName,
				viewerMemberId: memberId,
				members,
				round: view,
			};
		}),
	);

	// Games with no round today aren't part of the daily loop yet.
	return entries.filter((entry) => entry.round.state !== "none");
}
