import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameInvite, gameMember } from "@/lib/db/game";
import { user } from "@/lib/db/schema";
import { activeMembership } from "@/lib/games";
import { notifyGame, notifyUser } from "@/lib/realtime";

// Pending invites for a game — the inviter-side "who hasn't answered yet" view.
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id: gameId } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	if (!(await activeMembership(gameId, session.user.id))) {
		return NextResponse.json({ error: "not a member" }, { status: 403 });
	}

	const rows = await db
		.select({
			id: gameInvite.id,
			createdAt: gameInvite.createdAt,
			invitee: { id: user.id, name: user.name, image: user.image },
		})
		.from(gameInvite)
		.innerJoin(user, eq(gameInvite.inviteeId, user.id))
		.where(
			and(eq(gameInvite.gameId, gameId), eq(gameInvite.status, "pending")),
		);

	return NextResponse.json(rows);
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id: gameId } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	if (!(await activeMembership(gameId, session.user.id))) {
		return NextResponse.json({ error: "not a member" }, { status: 403 });
	}

	const body = await request.json().catch(() => null);
	const inviteeId = typeof body?.userId === "string" ? body.userId : "";
	if (!inviteeId) {
		return NextResponse.json({ error: "userId is required" }, { status: 400 });
	}
	if (inviteeId === session.user.id) {
		return NextResponse.json(
			{ error: "You're already in this game." },
			{ status: 400 },
		);
	}

	const [invitee] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.id, inviteeId))
		.limit(1);
	if (!invitee) {
		return NextResponse.json({ error: "user not found" }, { status: 404 });
	}

	const [alreadyMember] = await db
		.select({ id: gameMember.id })
		.from(gameMember)
		.where(
			and(
				eq(gameMember.gameId, gameId),
				eq(gameMember.userId, inviteeId),
				eq(gameMember.status, "active"),
			),
		)
		.limit(1);
	if (alreadyMember) {
		return NextResponse.json(
			{ error: "They're already in this game." },
			{ status: 409 },
		);
	}

	// Re-inviting someone who declined (or who left) reuses their row — the
	// unique (game, invitee) constraint makes this an upsert, not a duplicate.
	const [invite] = await db
		.insert(gameInvite)
		.values({ gameId, inviterId: session.user.id, inviteeId })
		.onConflictDoUpdate({
			target: [gameInvite.gameId, gameInvite.inviteeId],
			set: {
				inviterId: session.user.id,
				status: "pending",
				createdAt: new Date(),
				respondedAt: null,
			},
		})
		.returning();

	await notifyUser(inviteeId, "invite:received");
	await notifyGame(gameId, "game:members");

	return NextResponse.json(invite, { status: 201 });
}
