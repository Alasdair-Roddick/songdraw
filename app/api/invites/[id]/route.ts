import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { game, gameInvite, gameMember } from "@/lib/db/game";
import { notifyUser } from "@/lib/realtime";

// Accept / decline — invitee only.
export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const body = await request.json().catch(() => null);
	const action = body?.action;
	if (action !== "accept" && action !== "decline") {
		return NextResponse.json(
			{ error: "action must be accept or decline" },
			{ status: 400 },
		);
	}

	const [invite] = await db
		.select()
		.from(gameInvite)
		.where(
			and(
				eq(gameInvite.id, id),
				eq(gameInvite.inviteeId, session.user.id),
				eq(gameInvite.status, "pending"),
			),
		)
		.limit(1);

	// Same 404 whether it's someone else's invite or already answered — an
	// attacker shouldn't be able to probe for valid invite ids.
	if (!invite) {
		return NextResponse.json({ error: "invite not found" }, { status: 404 });
	}

	if (action === "decline") {
		await db
			.update(gameInvite)
			.set({ status: "declined", respondedAt: new Date() })
			.where(eq(gameInvite.id, id));

		await notifyUser(invite.inviterId, "invite:answered");
		return NextResponse.json({ status: "declined" });
	}

	await db.transaction(async (tx) => {
		await tx
			.update(gameInvite)
			.set({ status: "accepted", respondedAt: new Date() })
			.where(eq(gameInvite.id, id));

		// A previously-"left" member rejoining flips their row back to active
		// rather than colliding with the unique (game, user) constraint.
		await tx
			.insert(gameMember)
			.values({ gameId: invite.gameId, userId: session.user.id })
			.onConflictDoUpdate({
				target: [gameMember.gameId, gameMember.userId],
				set: { status: "active", joinedAt: new Date() },
			});
	});

	await notifyUser(invite.inviterId, "invite:answered");

	const [joined] = await db
		.select({ id: game.id, name: game.name })
		.from(game)
		.where(eq(game.id, invite.gameId))
		.limit(1);

	return NextResponse.json({ status: "accepted", game: joined });
}

// Cancel a pending invite — inviter or game owner.
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const [row] = await db
		.select({ invite: gameInvite, ownerId: game.ownerId })
		.from(gameInvite)
		.innerJoin(game, eq(gameInvite.gameId, game.id))
		.where(and(eq(gameInvite.id, id), eq(gameInvite.status, "pending")))
		.limit(1);

	if (!row) {
		return NextResponse.json({ error: "invite not found" }, { status: 404 });
	}
	if (
		row.invite.inviterId !== session.user.id &&
		row.ownerId !== session.user.id
	) {
		return NextResponse.json({ error: "not allowed" }, { status: 403 });
	}

	await db
		.update(gameInvite)
		.set({ status: "cancelled", respondedAt: new Date() })
		.where(eq(gameInvite.id, id));

	await notifyUser(row.invite.inviteeId, "invite:cancelled");

	return NextResponse.json({ status: "cancelled" });
}
