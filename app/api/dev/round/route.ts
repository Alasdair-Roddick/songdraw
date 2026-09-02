import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { round, statSnapshot } from "@/lib/db/round";
import { closeRoundsBefore, drawForGame } from "@/lib/draw";
import { activeMembership } from "@/lib/games";
import { notifyGame } from "@/lib/realtime";
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
		await notifyGame(gameId, "round:drawn");
		return NextResponse.json(result);
	}

	if (action === "advance") {
		// Rather than faking the clock — which would drift from gameDate() and
		// leave every read path blind — push existing rounds one day into the
		// past. Real-today is then free for a fresh draw, and yesterday settles
		// through the normal close path, streaks and all.
		// Updating adjacent dates directly collides with the unique
		// (game_id, round_date) constraint — yesterday tries to become the date
		// that the previous row still holds. Move the whole game's history out
		// of the way first, then bring it back one day earlier. The temporary
		// century offset exists only inside this transaction.
		await db.transaction(async (tx) => {
			await tx
				.update(round)
				.set({
					roundDate: sql`(${round.roundDate} + INTERVAL '100 years')::date`,
				})
				.where(eq(round.gameId, gameId));
			await tx
				.update(round)
				.set({
					roundDate: sql`(${round.roundDate} - INTERVAL '100 years 1 day')::date`,
				})
				.where(eq(round.gameId, gameId));
		});

		const closed = await closeRoundsBefore(today);
		const result = await drawForGame(gameId, today);
		await notifyGame(gameId, "round:drawn");
		return NextResponse.json({ closed, ...result });
	}

	if (action === "reset") {
		// Deleting the rounds is the whole reset: "played here" is derived from
		// them, so the members' banks become fully drawable again by itself.
		await db.transaction(async (tx) => {
			await tx.delete(round).where(eq(round.gameId, gameId));
			await tx.delete(statSnapshot).where(eq(statSnapshot.gameId, gameId));
		});
		await notifyGame(gameId, "round:reset");
		return NextResponse.json({ status: "reset" });
	}

	return NextResponse.json(
		{ error: "action must be draw, advance or reset" },
		{ status: 400 },
	);
}
