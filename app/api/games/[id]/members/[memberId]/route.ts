import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { game, gameMember } from "@/lib/db/game";
import { activeMembership } from "@/lib/games";
import { notifyGame, notifyUser } from "@/lib/realtime";

// Remove a member. The owner may remove anyone else; anyone may remove
// themselves (that's "leave"). Nobody may remove the owner — transferring
// ownership first is the only way out for them, which keeps every game owned.
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string; memberId: string }> },
) {
	const { id: gameId, memberId } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	if (!(await activeMembership(gameId, session.user.id))) {
		return NextResponse.json({ error: "not a member" }, { status: 403 });
	}

	const [current] = await db
		.select()
		.from(game)
		.where(eq(game.id, gameId))
		.limit(1);
	if (!current) {
		return NextResponse.json({ error: "game not found" }, { status: 404 });
	}

	const [target] = await db
		.select()
		.from(gameMember)
		.where(
			and(
				eq(gameMember.id, memberId),
				eq(gameMember.gameId, gameId),
				eq(gameMember.status, "active"),
			),
		)
		.limit(1);
	if (!target) {
		return NextResponse.json({ error: "member not found" }, { status: 404 });
	}

	const isSelf = target.userId === session.user.id;
	const isOwner = current.ownerId === session.user.id;

	if (target.userId === current.ownerId) {
		return NextResponse.json(
			{ error: "Hand ownership to someone else first." },
			{ status: 409 },
		);
	}
	if (!isSelf && !isOwner) {
		return NextResponse.json(
			{ error: "Only the owner can remove people." },
			{ status: 403 },
		);
	}

	// Soft removal, so past rounds keep referring to a real member row. Their
	// bank is untouched — it's theirs, not the room's; leaving simply drops
	// them from this game's candidate list.
	await db
		.update(gameMember)
		.set({ status: "left" })
		.where(eq(gameMember.id, memberId));

	if (!isSelf) await notifyUser(target.userId, "game:removed");
	await notifyGame(gameId, "game:members");

	return NextResponse.json({ status: isSelf ? "left" : "removed" });
}
