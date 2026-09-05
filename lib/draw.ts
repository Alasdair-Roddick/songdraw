import { createHash } from "node:crypto";
import { and, asc, count, eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { bankSong } from "@/lib/db/bank";
import { gameMember } from "@/lib/db/game";
import { guess, round, statSnapshot } from "@/lib/db/round";
import { MIN_MEMBERS } from "@/lib/game-rules";
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
	| { status: "dry" }
	// Distinct from `dry` on purpose: a dry pool means "feed me", a short room
	// means "invite someone". They need different nudges, so the draw job counts
	// them separately.
	| { status: "below_minimum" };

/**
 * Two-stage uniform draw (GamePlan §4): pick a member who still has a banked
 * song, then one of *their* songs. Picking the person first is what keeps daily
 * odds equal regardless of how big anyone's bank is.
 *
 * Drawing consumes the song: it flips to `played`, leaves the owner's bank, and
 * is never drawn again in any game.
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

		// GamePlan decision #3: the daily loop is closed below MIN_MEMBERS. This
		// was previously enforced nowhere — the constant appeared only in the UI,
		// so the game page showed "Locked" and the seat meter counted up while the
		// cron drew real rounds behind it. Two people can trivially deduce every
		// answer, which is the whole reason for the floor.
		const [{ members }] = await tx
			.select({ members: count() })
			.from(gameMember)
			.where(
				and(eq(gameMember.gameId, gameId), eq(gameMember.status, "active")),
			);
		if (members < MIN_MEMBERS) return { status: "below_minimum" } as const;

		// Ordered so the candidate list is identical on every replay — without
		// this the seed wouldn't actually make the draw reproducible.
		const available = await tx
			.select({ memberId: gameMember.id, bankSongId: bankSong.id })
			.from(gameMember)
			.innerJoin(bankSong, eq(bankSong.userId, gameMember.userId))
			.where(
				and(
					eq(gameMember.gameId, gameId),
					eq(gameMember.status, "active"),
					// Played songs are spent everywhere, not just here.
					eq(bankSong.status, "banked"),
				),
			)
			.orderBy(asc(gameMember.id), asc(bankSong.id));

		if (available.length === 0) return { status: "dry" } as const;

		const byMember = new Map<string, string[]>();
		for (const row of available) {
			const list = byMember.get(row.memberId) ?? [];
			list.push(row.bankSongId);
			byMember.set(row.memberId, list);
		}

		const rng = seededRandom(`${gameId}:${roundDate}`);
		const memberIds = [...byMember.keys()];
		const memberId = memberIds[Math.floor(rng() * memberIds.length)];
		const songs = byMember.get(memberId) as string[];
		const bankSongId = songs[Math.floor(rng() * songs.length)];

		const [created] = await tx
			.insert(round)
			.values({ gameId, roundDate, bankSongId })
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

		// Spend the song in the same transaction, so it can never be drawn twice
		// — by this game tomorrow or by another game later today.
		await tx
			.update(bankSong)
			.set({ status: "played" })
			.where(eq(bankSong.id, bankSongId));

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
			submitterUserId: bankSong.userId,
		})
		.from(round)
		.innerJoin(bankSong, eq(round.bankSongId, bankSong.id))
		.where(and(eq(round.status, "open"), lt(round.roundDate, today)))
		// Oldest first, and not optional. Streak continuity is decided by
		// `lastPlayedDate === previousDate(roundDate)`, so settling days out of
		// order breaks every streak that spans them. This only bites when the job
		// misses a day and two rounds go stale at once — which is exactly the
		// replay docs/runbook.md tells you to run to recover. The round flips to
		// `closed` in the same transaction, so a wrong settlement can't be replayed
		// away.
		.orderBy(asc(round.roundDate));

	let closed = 0;

	for (const staleRound of stale) {
		await db.transaction(async (tx) => {
			const members = await tx
				.select({ id: gameMember.id, userId: gameMember.userId })
				.from(gameMember)
				.where(
					and(
						eq(gameMember.gameId, staleRound.gameId),
						eq(gameMember.status, "active"),
					),
				);

			const guessers = await tx
				.select({ userId: guess.guesserUserId })
				.from(guess)
				.where(eq(guess.roundId, staleRound.id));
			const played = new Set(guessers.map((row) => row.userId));

			const yesterday = previousDate(staleRound.roundDate);

			for (const member of members) {
				const didPlay =
					played.has(member.userId) ||
					member.userId === staleRound.submitterUserId;

				const [stat] = await tx
					.select()
					.from(statSnapshot)
					.where(
						and(
							eq(statSnapshot.gameId, staleRound.gameId),
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
					? staleRound.roundDate
					: (stat?.lastPlayedDate ?? null);

				await tx
					.insert(statSnapshot)
					.values({
						gameId: staleRound.gameId,
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
				.where(eq(round.id, staleRound.id));
		});
		closed += 1;
	}

	return closed;
}
