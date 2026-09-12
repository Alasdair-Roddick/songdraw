import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { game } from "@/lib/db/game";
import { closeRoundsBefore, drawForGame } from "@/lib/draw";
import type { Database, RowChange } from "@/lib/mutation";
import { notifyGame, notifyUser } from "@/lib/realtime";
import { gameDate } from "@/lib/round-date";

export type Wakeup = { kind: "game" | "user"; id: string; event: string };

/** Cron and admin use one ordered job. An outer admin transaction also owns
 * these savepoints, so effects, evidence and the retry response commit together. */
export async function runDaily(
	database: Database = db,
	changes: RowChange[] = [],
	wakeups: Wakeup[] = [],
	today = gameDate(),
) {
	return database.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtext('songdraw:daily'))`,
		);
		const closed = await closeRoundsBefore(today, tx, changes);
		const games = await tx
			.select({ id: game.id })
			.from(game)
			.where(eq(game.status, "active"))
			.orderBy(asc(game.id));
		const results = {
			date: today,
			closed,
			created: 0,
			exists: 0,
			dry: 0,
			below_minimum: 0,
			failed: 0,
		};
		for (const current of games) {
			const drawn: RowChange[] = [];
			try {
				const result = await drawForGame(current.id, today, tx, drawn);
				results[result.status] += 1;
				changes.push(...drawn);
				if (result.status === "created")
					wakeups.push({ kind: "game", id: current.id, event: "round:drawn" });
			} catch {
				// drawForGame's savepoint rolls back this game's writes. Never log
				// a database exception here: it can contain song ownership or SQL.
				results.failed += 1;
				console.error(`draw failed for game ${current.id}`);
			}
		}
		return results;
	});
}

/** Only after commit; polling is the fallback if a wake-up cannot be delivered. */
export async function sendWakeups(wakeups: Wakeup[]) {
	await Promise.all(
		wakeups.map(async ({ kind, id, event }) => {
			try {
				await (kind === "game" ? notifyGame(id, event) : notifyUser(id, event));
			} catch {
				console.error("post-commit notification failed");
			}
		}),
	);
}
