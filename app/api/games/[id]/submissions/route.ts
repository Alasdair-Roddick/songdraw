import { and, count, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameMember } from "@/lib/db/game";
import { guess, round } from "@/lib/db/round";
import { submission } from "@/lib/db/submission";
import { MIN_MEMBERS, REPLAY_AFTER_DAYS } from "@/lib/game-rules";
import { activeMembership } from "@/lib/games";
import { upsertTrackAsset } from "@/lib/music/cache";
import type { Track } from "@/lib/music/types";
import { gameDate } from "@/lib/round-date";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id: gameId } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const membership = await activeMembership(gameId, session.user.id);
	if (!membership) {
		return NextResponse.json({ error: "not a member" }, { status: 403 });
	}

	// GamePlan §2: submission is closed entirely below 3 members.
	const [{ members }] = await db
		.select({ members: count() })
		.from(gameMember)
		.where(and(eq(gameMember.gameId, gameId), eq(gameMember.status, "active")));
	if (members < MIN_MEMBERS) {
		return NextResponse.json(
			{ error: `Submission unlocks at ${MIN_MEMBERS} members.` },
			{ status: 403 },
		);
	}

	// M4-5: once a round is running, playing gates submitting — the pool can
	// only be fed by people who actually showed up. Being the submitter counts
	// as playing, so your own day doesn't lock you out. Before the first round
	// ever drawn there's nothing to gate on, which is how the pool gets seeded.
	const [today] = await db
		.select({
			id: round.id,
			submitterMemberId: submission.memberId,
		})
		.from(round)
		.innerJoin(submission, eq(round.submissionId, submission.id))
		.where(and(eq(round.gameId, gameId), eq(round.roundDate, gameDate())))
		.limit(1);

	if (today && today.submitterMemberId !== membership.id) {
		const [played] = await db
			.select({ id: guess.id })
			.from(guess)
			.where(
				and(
					eq(guess.roundId, today.id),
					eq(guess.guesserUserId, session.user.id),
				),
			)
			.limit(1);
		if (!played) {
			return NextResponse.json(
				{ error: "Guess today's song first." },
				{ status: 403 },
			);
		}
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

	// Duplicate rule (M3-4). An unplayed song is secret — only its submitter
	// knows it exists — so two people banking the same track is fine and makes
	// for a good reveal. What we block is re-banking something *you* already
	// hold, and anything the whole game has already seen.
	const [mine] = await db
		.select({ id: submission.id })
		.from(submission)
		.where(
			and(
				eq(submission.gameId, gameId),
				eq(submission.memberId, membership.id),
				eq(submission.trackId, asset.id),
				eq(submission.status, "pooled"),
			),
		)
		.limit(1);
	if (mine) {
		return NextResponse.json(
			{ error: "That one's already in your pool." },
			{ status: 409 },
		);
	}

	const replayCutoff = new Date(
		Date.now() - REPLAY_AFTER_DAYS * 24 * 60 * 60 * 1000,
	);
	const [recentlyPlayed] = await db
		.select({ id: submission.id })
		.from(submission)
		.where(
			and(
				eq(submission.gameId, gameId),
				eq(submission.trackId, asset.id),
				eq(submission.status, "played"),
				gt(submission.submittedAt, replayCutoff),
			),
		)
		.limit(1);
	if (recentlyPlayed) {
		return NextResponse.json(
			{ error: "This game's already played that one." },
			{ status: 409 },
		);
	}

	const [row] = await db
		.insert(submission)
		.values({ gameId, memberId: membership.id, trackId: asset.id })
		// Re-banking a track you previously retired just revives that row.
		.onConflictDoUpdate({
			target: [submission.gameId, submission.memberId, submission.trackId],
			set: { status: "pooled", submittedAt: new Date() },
		})
		.returning();

	return NextResponse.json(row, { status: 201 });
}
