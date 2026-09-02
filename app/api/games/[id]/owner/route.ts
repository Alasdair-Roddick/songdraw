import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { game, gameMember } from "@/lib/db/game";
import { notifyUser } from "@/lib/realtime";

// Hand the game to another active member. Owner only, and the two role rows
// swap in the same transaction as game.ownerId so a game is never ownerless
// or double-owned.
export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id: gameId } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const [current] = await db
		.select()
		.from(game)
		.where(eq(game.id, gameId))
		.limit(1);
	if (!current) {
		return NextResponse.json({ error: "game not found" }, { status: 404 });
	}
	if (current.ownerId !== session.user.id) {
		return NextResponse.json(
			{ error: "Only the owner can hand over a game." },
			{ status: 403 },
		);
	}

	const body = await request.json().catch(() => null);
	const nextOwnerId = typeof body?.userId === "string" ? body.userId : "";
	if (!nextOwnerId) {
		return NextResponse.json({ error: "userId is required" }, { status: 400 });
	}
	if (nextOwnerId === session.user.id) {
		return NextResponse.json(
			{ error: "You already own this game." },
			{ status: 400 },
		);
	}

	const [target] = await db
		.select()
		.from(gameMember)
		.where(
			and(
				eq(gameMember.gameId, gameId),
				eq(gameMember.userId, nextOwnerId),
				eq(gameMember.status, "active"),
			),
		)
		.limit(1);
	if (!target) {
		return NextResponse.json(
			{ error: "They're not in this game." },
			{ status: 404 },
		);
	}

	await db.transaction(async (tx) => {
		await tx
			.update(game)
			.set({ ownerId: nextOwnerId })
			.where(eq(game.id, gameId));

		await tx
			.update(gameMember)
			.set({ role: "member" })
			.where(
				and(
					eq(gameMember.gameId, gameId),
					eq(gameMember.userId, session.user.id),
				),
			);

		await tx
			.update(gameMember)
			.set({ role: "owner" })
			.where(eq(gameMember.id, target.id));
	});

	await notifyUser(nextOwnerId, "game:owner");

	return NextResponse.json({ status: "transferred" });
}
