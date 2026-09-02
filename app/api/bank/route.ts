import { and, desc, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bankSong } from "@/lib/db/bank";
import { gameMember } from "@/lib/db/game";
import { guess, round } from "@/lib/db/round";
import { trackAsset } from "@/lib/db/track-asset";
import { upsertTrackAsset } from "@/lib/music/cache";
import type { Track } from "@/lib/music/types";
import { gameDate } from "@/lib/round-date";

/**
 * How many of today's rounds still owe a guess from this user.
 *
 * Banking is gated on this (M4-5, adapted to a shared bank). One bank feeds
 * every game, so it can't be gated per-game any more — it unlocks once you've
 * cleared every round waiting on you, which is exactly the "all songs guessed"
 * moment the feed builds toward.
 */
export async function outstandingGuesses(userId: string) {
	const rows = await db
		.select({ roundId: round.id, submitterUserId: bankSong.userId })
		.from(gameMember)
		.innerJoin(
			round,
			and(eq(round.gameId, gameMember.gameId), eq(round.roundDate, gameDate())),
		)
		.innerJoin(bankSong, eq(round.bankSongId, bankSong.id))
		.where(and(eq(gameMember.userId, userId), eq(gameMember.status, "active")));

	// Your own song isn't yours to guess.
	const owed = rows.filter((row) => row.submitterUserId !== userId);
	if (owed.length === 0) return 0;

	const answered = await db
		.select({ roundId: guess.roundId })
		.from(guess)
		.where(
			and(
				eq(guess.guesserUserId, userId),
				inArray(
					guess.roundId,
					owed.map((row) => row.roundId),
				),
			),
		);
	const done = new Set(answered.map((row) => row.roundId));
	return owed.filter((row) => !done.has(row.roundId)).length;
}

export async function GET() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

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
		.where(eq(bankSong.userId, session.user.id))
		.orderBy(desc(bankSong.createdAt));

	return NextResponse.json({
		songs,
		outstanding: await outstandingGuesses(session.user.id),
	});
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

	const [row] = await db
		.insert(bankSong)
		.values({ userId: session.user.id, trackId: asset.id })
		.onConflictDoNothing({ target: [bankSong.userId, bankSong.trackId] })
		.returning();

	if (!row) {
		return NextResponse.json(
			{ error: "That one's already in your bank." },
			{ status: 409 },
		);
	}

	return NextResponse.json(row, { status: 201 });
}
