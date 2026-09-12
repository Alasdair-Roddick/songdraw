import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { game, gameMember } from "@/lib/db/game";
import { account, session, user } from "@/lib/db/schema";
import { setGameStatus } from "@/lib/moderation";

/**
 * Closing an account without destroying everyone else's game.
 *
 * A hard `DELETE FROM "user"` cascades catastrophically. Verified against
 * drizzle/0000_baseline.sql, deleting one row takes with it:
 *
 *   user → game (owner_id) → every member, round, guess and invite in it
 *   user → bank_song → round → guess
 *   user → game_member → guess (as guessed_member_id)
 *
 * So one person leaving would delete rounds other people played, guesses other
 * people made, and entire rooms other people were in — while leaving those
 * players' stat_snapshot counters intact and now permanently inflated against
 * rows that no longer exist. There is no compensating write anywhere.
 *
 * Instead the row survives and is emptied. The account becomes unusable (no
 * credentials, no sessions, scrubbed identity) while history stays honest:
 * "submitted by Former player" still reads correctly, and nobody else's streak
 * or leaderboard silently changes.
 */

/** Enough entropy to satisfy user_name_lower_unique across many closures. */
function tombstoneSuffix() {
	return crypto.randomUUID().replaceAll("-", "").slice(0, 6);
}

export async function closeAccount(userId: string) {
	return db.transaction(async (tx) => {
		// Games they own need a new owner, or nobody can administer them. The
		// longest-standing other member inherits.
		const owned = await tx
			.select({ id: game.id })
			.from(game)
			.where(eq(game.ownerId, userId))
			.orderBy(asc(game.id))
			.for("update");

		for (const ownedGame of owned) {
			const [heir] = await tx
				.select({ id: gameMember.id, userId: gameMember.userId })
				.from(gameMember)
				.where(
					and(
						eq(gameMember.gameId, ownedGame.id),
						eq(gameMember.status, "active"),
						ne(gameMember.userId, userId),
					),
				)
				.orderBy(asc(gameMember.joinedAt))
				.limit(1);

			if (heir) {
				// game.owner_id and the single role='owner' row must agree — they are
				// swapped together, exactly as the transfer route does it.
				await tx
					.update(game)
					.set({ ownerId: heir.userId })
					.where(eq(game.id, ownedGame.id));
				await tx
					.update(gameMember)
					.set({ role: "owner" })
					.where(eq(gameMember.id, heir.id));
			} else {
				// Last one out. Archiving rather than deleting keeps the room's
				// history readable; anything but 'active' drops it from the nightly
				// draw (see app/api/internal/draw/route.ts).
				await setGameStatus(tx, ownedGame.id, "archived");
			}
		}

		// Soft-leave every room. 'left' is a tombstone, not a delete: past rounds
		// still point at these rows via guess.guessed_member_id.
		await tx
			.update(gameMember)
			.set({ role: "member", status: "left" })
			.where(eq(gameMember.userId, userId));

		// Credentials and sessions go for real — this is what closes the account.
		await tx.delete(account).where(eq(account.userId, userId));
		await tx.delete(session).where(eq(session.userId, userId));

		// Scrub the identity, keep the row. The email is made permanently
		// unusable rather than nulled, because it is NOT NULL and unique.
		const suffix = tombstoneSuffix();
		await tx
			.update(user)
			.set({
				name: `Former player ${suffix}`,
				email: `deleted+${suffix}@songdraw.invalid`,
				emailVerified: false,
				image: null,
			})
			.where(eq(user.id, userId));
	});
}
