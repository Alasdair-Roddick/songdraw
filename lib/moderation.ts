import { and, eq } from "drizzle-orm";
import { game, gameInvite, gameMember } from "@/lib/db/game";
import {
	MutationError,
	type RowChange,
	type Transaction,
} from "@/lib/mutation";

/** Serialize player responses with cancellation, so a cancelled invite cannot
 * be accepted by a request that read it before the cancellation committed. */
export async function respondToInvite(
	tx: Transaction,
	inviteId: string,
	playerId: string,
	action: "accept" | "decline",
) {
	const [invite] = await tx
		.select()
		.from(gameInvite)
		.where(
			and(
				eq(gameInvite.id, inviteId),
				eq(gameInvite.inviteeId, playerId),
				eq(gameInvite.status, "pending"),
			),
		)
		.for("update");
	if (!invite) throw new MutationError(404, "Invite not found.");
	await tx
		.update(gameInvite)
		.set({
			status: action === "accept" ? "accepted" : "declined",
			respondedAt: new Date(),
		})
		.where(eq(gameInvite.id, inviteId));
	if (action === "accept") {
		await tx
			.insert(gameMember)
			.values({ gameId: invite.gameId, userId: playerId })
			.onConflictDoUpdate({
				target: [gameMember.gameId, gameMember.userId],
				set: { status: "active", joinedAt: new Date() },
			});
	}
	return invite;
}

/** Both transfer and removal lock the game before checking its active members. */
export async function transferOwnership(
	tx: Transaction,
	gameId: string,
	playerId: string,
	nextOwnerId: string,
) {
	const [current] = await tx
		.select()
		.from(game)
		.where(eq(game.id, gameId))
		.for("update");
	if (!current) throw new MutationError(404, "Game not found.");
	if (current.ownerId !== playerId)
		throw new MutationError(403, "Only the owner can hand over a game.");
	if (nextOwnerId === playerId)
		throw new MutationError(400, "You already own this game.");
	const [target] = await tx
		.select()
		.from(gameMember)
		.where(
			and(
				eq(gameMember.gameId, gameId),
				eq(gameMember.userId, nextOwnerId),
				eq(gameMember.status, "active"),
			),
		)
		.for("update");
	if (!target) throw new MutationError(404, "They're not in this game.");
	await tx
		.update(game)
		.set({ ownerId: nextOwnerId })
		.where(eq(game.id, gameId));
	await tx
		.update(gameMember)
		.set({ role: "member" })
		.where(and(eq(gameMember.gameId, gameId), eq(gameMember.userId, playerId)));
	await tx
		.update(gameMember)
		.set({ role: "owner" })
		.where(eq(gameMember.id, target.id));
}

export async function setGameStatus(
	tx: Transaction,
	gameId: string,
	status: "active" | "archived",
	changes: RowChange[] = [],
) {
	const [before] = await tx
		.select()
		.from(game)
		.where(eq(game.id, gameId))
		.for("update");
	if (!before) throw new MutationError(404, "Game not found.");
	const [after] = await tx
		.update(game)
		.set({ status })
		.where(eq(game.id, gameId))
		.returning();
	changes.push({ table: "game", before, after });
	return after;
}

/** Undefined playerId means the caller has passed the internal admin guard. */
export async function removeMember(
	tx: Transaction,
	gameId: string,
	memberId: string,
	playerId?: string,
	changes: RowChange[] = [],
) {
	// Ownership transfers update this same row: hold it until the removal commits.
	const [current] = await tx
		.select()
		.from(game)
		.where(eq(game.id, gameId))
		.for("update");
	if (!current) throw new MutationError(404, "Game not found.");
	const [before] = await tx
		.select()
		.from(gameMember)
		.where(
			and(
				eq(gameMember.id, memberId),
				eq(gameMember.gameId, gameId),
				eq(gameMember.status, "active"),
			),
		)
		.for("update");
	if (!before) throw new MutationError(404, "Member not found.");
	if (before.userId === current.ownerId)
		throw new MutationError(
			409,
			"Hand ownership to someone else first.",
			before,
		);
	if (playerId && before.userId !== playerId && current.ownerId !== playerId)
		throw new MutationError(403, "Only the owner can remove people.", before);
	const [after] = await tx
		.update(gameMember)
		.set({ status: "left" })
		.where(eq(gameMember.id, memberId))
		.returning();
	changes.push({ table: "game_member", before, after });
	return after;
}

export async function cancelInvite(
	tx: Transaction,
	inviteId: string,
	playerId?: string,
	changes: RowChange[] = [],
) {
	const [row] = await tx
		.select({ invite: gameInvite, ownerId: game.ownerId })
		.from(gameInvite)
		.innerJoin(game, eq(gameInvite.gameId, game.id))
		.where(and(eq(gameInvite.id, inviteId), eq(gameInvite.status, "pending")))
		.for("update");
	if (!row) throw new MutationError(404, "Invite not found.");
	const before = row.invite;
	if (playerId && before.inviterId !== playerId && row.ownerId !== playerId)
		throw new MutationError(403, "Not allowed.", before);
	const [after] = await tx
		.update(gameInvite)
		.set({ status: "cancelled", respondedAt: new Date() })
		.where(eq(gameInvite.id, inviteId))
		.returning();
	changes.push({ table: "game_invite", before, after });
	return after;
}
