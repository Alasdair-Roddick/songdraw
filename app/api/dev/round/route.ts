import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { round, statSnapshot } from "@/lib/db/round";
import { submission } from "@/lib/db/submission";
import { closeRoundsBefore, drawForGame } from "@/lib/draw";
import { activeMembership } from "@/lib/games";
import { gameDate } from "@/lib/round-date";

// Dev-only harness for the daily loop, so you don't have to wait for Adelaide
// midnight to see a round. Refuses to exist in production — this endpoint can
// fabricate and destroy rounds, so the gate is the whole safety story.
export async function POST(request: Request) {
	if (process.env.NODE_ENV === "production") {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}

	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const body = await request.json().catch(() => null);
	const gameId = typeof body?.gameId === "string" ? body.gameId : "";
	const action = body?.action;

	// Still membership-gated: convenient in dev shouldn't mean a backdoor into
	// games you're not in.
	if (!gameId || !(await activeMembership(gameId, session.user.id))) {
		return NextResponse.json({ error: "not a member" }, { status: 403 });
	}

	const today = gameDate();

	if (action === "draw") {
		const result = await drawForGame(gameId, today);
		return NextResponse.json(result);
	}

	if (action === "advance") {
		// Rather than faking the clock — which would drift from gameDate() and
		// leave every read path blind — push existing rounds one day into the
		// past. Real-today is then free for a fresh draw, and yesterday settles
		// through the normal close path, streaks and all.
		await db
			.update(round)
			.set({
				roundDate: sql`(${round.roundDate} - INTERVAL '1 day')::date`,
			})
			.where(eq(round.gameId, gameId));

		const closed = await closeRoundsBefore(today);
		const result = await drawForGame(gameId, today);
		return NextResponse.json({ closed, ...result });
	}

	if (action === "reset") {
		await db.transaction(async (tx) => {
			// Guesses cascade with their round.
			await tx.delete(round).where(eq(round.gameId, gameId));
			await tx.delete(statSnapshot).where(eq(statSnapshot.gameId, gameId));
			// Only revive songs the draw consumed — a "retired" song belongs to
			// someone who left, and reviving it would put them back in the draw.
			await tx
				.update(submission)
				.set({ status: "pooled", playedInRoundId: null })
				.where(
					sql`${submission.gameId} = ${gameId} AND ${submission.status} = 'played'`,
				);
		});
		return NextResponse.json({ status: "reset" });
	}

	return NextResponse.json(
		{ error: "action must be draw, advance or reset" },
		{ status: 400 },
	);
}
