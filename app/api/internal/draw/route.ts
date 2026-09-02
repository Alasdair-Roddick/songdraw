import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { game } from "@/lib/db/game";
import { closeRoundsBefore, drawForGame } from "@/lib/draw";
import { notifyOps } from "@/lib/ntfy";
import { notifyGame } from "@/lib/realtime";
import { gameDate } from "@/lib/round-date";

// Fired by the cron sidecar at 00:00 Australia/Adelaide. Idempotent by design
// (unique game_id+round_date), so a double-fire, a retry, or a manual replay
// all converge on exactly one round per game per day.
export async function POST(request: Request) {
	const authHeader = request.headers.get("authorization");
	const expected = `Bearer ${process.env.CRON_TOKEN}`;

	if (!process.env.CRON_TOKEN || authHeader !== expected) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const today = gameDate();

	// Settle yesterday before drawing today, so a miss can't be retroactively
	// rescued by guessing after midnight.
	const closed = await closeRoundsBefore(today);

	const games = await db
		.select({ id: game.id, name: game.name, ownerId: game.ownerId })
		.from(game)
		.where(eq(game.status, "active"));

	const results = { created: 0, exists: 0, dry: 0, failed: 0 };

	for (const current of games) {
		try {
			const result = await drawForGame(current.id, today);
			results[result.status === "created" ? "created" : result.status] += 1;

			// Wakes every open client straight into today's round.
			if (result.status === "created")
				await notifyGame(current.id, "round:drawn");

			if (result.status === "dry") {
				await notifyOps(
					"song-pool-dry",
					`${current.name}: nobody has a song pooled, so today was skipped.`,
				);
			}
		} catch (err) {
			results.failed += 1;
			console.error(`draw failed for game ${current.id}`, err);
			await notifyOps(
				"song-draw-failed",
				`${current.name}: draw failed — ${(err as Error).message}`,
			);
		}
	}

	return NextResponse.json({ date: today, closed, ...results });
}
