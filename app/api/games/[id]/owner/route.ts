import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { transferOwnership } from "@/lib/moderation";
import { MutationError } from "@/lib/mutation";
import { notifyGame, notifyUser } from "@/lib/realtime";

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

	const body = await request.json().catch(() => null);
	const nextOwnerId = typeof body?.userId === "string" ? body.userId : "";
	if (!nextOwnerId) {
		return NextResponse.json({ error: "userId is required" }, { status: 400 });
	}
	try {
		await db.transaction((tx) =>
			transferOwnership(tx, gameId, session.user.id, nextOwnerId),
		);
	} catch (error) {
		if (error instanceof MutationError)
			return NextResponse.json(
				{ error: error.message },
				{ status: error.status },
			);
		throw error;
	}

	await notifyUser(nextOwnerId, "game:owner");
	await notifyGame(gameId, "game:members");

	return NextResponse.json({ status: "transferred" });
}
