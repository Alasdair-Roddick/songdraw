import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendWakeups } from "@/lib/daily-job";
import { db } from "@/lib/db";
import { game } from "@/lib/db/game";
import { cancelInvite, respondToInvite } from "@/lib/moderation";
import { MutationError } from "@/lib/mutation";
import { notifyGame, notifyUser } from "@/lib/realtime";

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

	let invite: Awaited<ReturnType<typeof respondToInvite>>;
	try {
		invite = await db.transaction((tx) =>
			respondToInvite(tx, id, session.user.id, action),
		);
	} catch (error) {
		if (error instanceof MutationError)
			return NextResponse.json(
				{ error: error.message },
				{ status: error.status },
			);
		throw error;
	}
	if (action === "decline") {
		await sendWakeups([
			{ kind: "user", id: invite.inviterId, event: "invite:answered" },
		]);
		return NextResponse.json({ status: "declined" });
	}

	await notifyUser(invite.inviterId, "invite:answered");
	// Refresh the invitee's other tabs too: this is the signal that makes a
	// newly joined room appear without a manual reload.
	await notifyUser(session.user.id, "game:joined");
	await notifyGame(invite.gameId, "game:members");

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

	try {
		const invite = await db.transaction((tx) =>
			cancelInvite(tx, id, session.user.id),
		);
		await sendWakeups([
			{ kind: "user", id: invite.inviteeId, event: "invite:cancelled" },
		]);
		return NextResponse.json({ status: "cancelled" });
	} catch (error) {
		if (error instanceof MutationError)
			return NextResponse.json(
				{ error: error.message },
				{ status: error.status },
			);
		throw error;
	}
}
