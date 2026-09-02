import { and, count, desc, eq, gt, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bankSong } from "@/lib/db/bank";
import { gameMember } from "@/lib/db/game";
import { guess, round } from "@/lib/db/round";
import { trackAsset } from "@/lib/db/track-asset";
import { REPLAY_AFTER_ROUNDS, revealHour } from "@/lib/game-rules";
import { upsertTrackAsset } from "@/lib/music/cache";
import type { Track } from "@/lib/music/types";
import { gameDate, isPastRevealHour } from "@/lib/round-date";

/**
 * How many of today's rounds are still waiting on a guess from this user *and*
 * can still be guessed.
 *
 * Banking is gated on this (M4-5, adapted to a shared bank): one bank feeds
 * every game, so it unlocks once nothing is waiting on you — which is exactly
 * the "all songs guessed" moment the home feed builds toward.
 *
 * Rounds past the reveal are excluded deliberately. Guessing closes then, so
 * counting them would leave you unable to ever clear the gate and locked out of
 * banking until midnight.
 */
export async function outstandingGuesses(userId: string) {
	const rows = await db
		.select({
			roundId: round.id,
			roundDate: round.roundDate,
			submitterUserId: bankSong.userId,
		})
		.from(gameMember)
		.innerJoin(
			round,
			and(eq(round.gameId, gameMember.gameId), eq(round.roundDate, gameDate())),
		)
		.innerJoin(bankSong, eq(round.bankSongId, bankSong.id))
		.where(
			and(
				eq(gameMember.userId, userId),
				eq(gameMember.status, "active"),
				eq(round.status, "open"),
			),
		);

	const actionable = rows.filter(
		(row) =>
			// Your own song isn't yours to guess.
			row.submitterUserId !== userId &&
			!isPastRevealHour(row.roundDate, revealHour()),
	);
	if (actionable.length === 0) return 0;

	const answered = await db
		.select({ roundId: guess.roundId })
		.from(guess)
		.where(
			and(
				eq(guess.guesserUserId, userId),
				inArray(
					guess.roundId,
					actionable.map((row) => row.roundId),
				),
			),
		);
	const done = new Set(answered.map((row) => row.roundId));
	return actionable.filter((row) => !done.has(row.roundId)).length;
}

export async function GET() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	// Played songs have left the bank — they live on only as round history.
	const songs = await db
		.select({
			id: bankSong.id,
			title: trackAsset.title,
			artist: trackAsset.artist,
			artworkUrl: trackAsset.artworkUrl,
			previewUrl: trackAsset.previewUrl,
		})
		.from(bankSong)
		.innerJoin(trackAsset, eq(bankSong.trackId, trackAsset.id))
		.where(
			and(eq(bankSong.userId, session.user.id), eq(bankSong.status, "banked")),
		)
		.orderBy(desc(bankSong.createdAt));

	return NextResponse.json({
		songs,
		outstanding: await outstandingGuesses(session.user.id),
	});
}

/**
 * How many rounds a game has drawn since the one that played `bankSongId`.
 * Used for the replay cooldown — a track can come back to your bank once its
 * game has moved on by REPLAY_AFTER_ROUNDS.
 */
async function roundsSincePlayed(bankSongId: string) {
	const [played] = await db
		.select({ gameId: round.gameId, roundDate: round.roundDate })
		.from(round)
		.where(eq(round.bankSongId, bankSongId))
		.limit(1);
	if (!played) return Number.POSITIVE_INFINITY;

	const [{ since }] = await db
		.select({ since: count() })
		.from(round)
		.where(
			and(
				eq(round.gameId, played.gameId),
				gt(round.roundDate, played.roundDate),
			),
		);
	return since;
}

export async function POST(request: Request) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const outstanding = await outstandingGuesses(session.user.id);
	if (outstanding > 0) {
		return NextResponse.json(
			{
				error: `Guess today's ${
					outstanding === 1 ? "song" : `${outstanding} songs`
				} first.`,
			},
			{ status: 403 },
		);
	}

	const track: Track = await request.json().catch(() => null);
	if (
		!track?.provider ||
		!track?.providerTrackId ||
		!track?.title ||
		!track?.artist
	) {
		return NextResponse.json({ error: "invalid track" }, { status: 400 });
	}

	// Cache first — gameplay reads only from our own copy (M2-3), so a track
	// must exist locally before anything can point at it.
	const asset = await upsertTrackAsset(track);

	const mine = await db
		.select({ id: bankSong.id, status: bankSong.status })
		.from(bankSong)
		.where(
			and(eq(bankSong.userId, session.user.id), eq(bankSong.trackId, asset.id)),
		);

	if (mine.some((row) => row.status === "banked")) {
		return NextResponse.json(
			{ error: "That one's already in your bank." },
			{ status: 409 },
		);
	}

	// Re-banking a track you've had played: only once its game has moved on.
	for (const row of mine) {
		const since = await roundsSincePlayed(row.id);
		if (since < REPLAY_AFTER_ROUNDS) {
			const left = REPLAY_AFTER_ROUNDS - since;
			return NextResponse.json(
				{
					error: `You played that recently — ${left} more round${
						left === 1 ? "" : "s"
					} before you can bank it again.`,
				},
				{ status: 409 },
			);
		}
	}

	const [row] = await db
		.insert(bankSong)
		.values({ userId: session.user.id, trackId: asset.id })
		.returning();

	return NextResponse.json(row, { status: 201 });
}
