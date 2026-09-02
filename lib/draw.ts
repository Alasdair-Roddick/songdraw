import { createHash } from "node:crypto";
import { and, asc, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { gameMember } from "@/lib/db/game";
import { guess, round, statSnapshot } from "@/lib/db/round";
import { submission } from "@/lib/db/submission";
import { previousDate } from "@/lib/round-date";

// Seeded so a given (game, date) always draws the same song no matter how many
// times the job runs or when it's replayed — GamePlan §4.
function seededRandom(seed: string) {
	let state = createHash("sha256").update(seed).digest().readUInt32BE(0);
	return () => {
		state |= 0;
		state = (state + 0x6d2b79f5) | 0;
		let t = Math.imul(state ^ (state >>> 15), 1 | state);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export type DrawResult =
	| { status: "created"; roundId: string }
	| { status: "exists"; roundId: string }
	| { status: "dry" };

/**
 * Two-stage uniform draw (GamePlan §4): pick a member with at least one pooled
 * song, then one of *their* songs. Picking the member first is what keeps daily
 * odds equal regardless of how big anyone's pool is.
 */
export async function drawForGame(
	gameId: string,
	roundDate: string,
): Promise<DrawResult> {
	return db.transaction(async (tx) => {
		const existing = await tx
			.select({ id: round.id })
			.from(round)
			.where(and(eq(round.gameId, gameId), eq(round.roundDate, roundDate)))
			.limit(1);
		if (existing.length > 0) {
			return { status: "exists", roundId: existing[0].id } as const;
		}

		// Ordered by id so the candidate list is identical on every replay —
		// without this the seed wouldn't actually make the draw reproducible.
		const pooled = await tx
			.select({
				memberId: submission.memberId,
				submissionId: submission.id,
			})
			.from(submission)
			.innerJoin(gameMember, eq(submission.memberId, gameMember.id))
			.where(
				and(
					eq(submission.gameId, gameId),
					eq(submission.status, "pooled"),
					eq(gameMember.status, "active"),
				),
			)
			.orderBy(asc(submission.memberId), asc(submission.id));

		if (pooled.length === 0) return { status: "dry" } as const;

		const byMember = new Map<string, string[]>();
		for (const row of pooled) {
			const list = byMember.get(row.memberId) ?? [];
			list.push(row.submissionId);
			byMember.set(row.memberId, list);
		}

		const rng = seededRandom(`${gameId}:${roundDate}`);
		const memberIds = [...byMember.keys()];
		const memberId = memberIds[Math.floor(rng() * memberIds.length)];
		const songs = byMember.get(memberId) as string[];
		const submissionId = songs[Math.floor(rng() * songs.length)];

		const [created] = await tx
			.insert(round)
			.values({ gameId, roundDate, submissionId })
			// Belt and braces against two jobs racing past the check above; the
			// unique (game_id, round_date) index is the real guarantee.
			.onConflictDoNothing({ target: [round.gameId, round.roundDate] })
			.returning({ id: round.id });

		if (!created) {
			const [row] = await tx
				.select({ id: round.id })
				.from(round)
				.where(and(eq(round.gameId, gameId), eq(round.roundDate, roundDate)))
				.limit(1);
			return { status: "exists", roundId: row.id } as const;
		}

		// Retire the song in the same transaction, so a played track can never
		// be drawn twice even if the job dies immediately after.
		await tx
			.update(submission)
			.set({ status: "played", playedInRoundId: created.id })
			.where(eq(submission.id, submissionId));

		return { status: "created", roundId: created.id } as const;
	});
}

/**
 * Close every round older than `today` and settle streaks (GamePlan M4-4).
 * Playing means guessing *or* being the submitter — the submitter's day counts
 * automatically, it isn't a bye. Anyone who did neither breaks their streak.
 *
 * Only ever selects `open` rounds and flips them closed in the same
 * transaction, so re-running the job can't double-count a streak.
 */
export async function closeRoundsBefore(today: string) {
	const stale = await db
		.select({
			id: round.id,
			gameId: round.gameId,
			roundDate: round.roundDate,
			submitterMemberId: submission.memberId,
		})
		.from(round)
		.innerJoin(submission, eq(round.submissionId, submission.id))
		.where(and(eq(round.status, "open"), lt(round.roundDate, today)));

	let closed = 0;

	for (const stale_round of stale) {
		await db.transaction(async (tx) => {
			const members = await tx
				.select({ id: gameMember.id, userId: gameMember.userId })
				.from(gameMember)
				.where(
					and(
						eq(gameMember.gameId, stale_round.gameId),
						eq(gameMember.status, "active"),
					),
				);

			const guessers = await tx
				.select({ userId: guess.guesserUserId })
				.from(guess)
				.where(eq(guess.roundId, stale_round.id));
			const played = new Set(guessers.map((g) => g.userId));

			const yesterday = previousDate(stale_round.roundDate);

			for (const member of members) {
				const didPlay =
					played.has(member.userId) ||
					member.id === stale_round.submitterMemberId;

				const [stat] = await tx
					.select()
					.from(statSnapshot)
					.where(
						and(
							eq(statSnapshot.gameId, stale_round.gameId),
							eq(statSnapshot.userId, member.userId),
						),
					)
					.limit(1);

				// A streak continues only if the previous day was also played;
				// any gap restarts it at 1.
				const continues = stat?.lastPlayedDate === yesterday;
				const currentStreak = didPlay
					? continues
						? stat.currentStreak + 1
						: 1
					: 0;
				const bestStreak = Math.max(stat?.bestStreak ?? 0, currentStreak);
				const lastPlayedDate = didPlay
					? stale_round.roundDate
					: (stat?.lastPlayedDate ?? null);

				await tx
					.insert(statSnapshot)
					.values({
						gameId: stale_round.gameId,
						userId: member.userId,
						currentStreak,
						bestStreak,
						lastPlayedDate,
					})
					.onConflictDoUpdate({
						target: [statSnapshot.gameId, statSnapshot.userId],
						set: { currentStreak, bestStreak, lastPlayedDate },
					});
			}

			await tx
				.update(round)
				.set({ status: "closed" })
				.where(eq(round.id, stale_round.id));
		});
		closed += 1;
	}

	return closed;
}
