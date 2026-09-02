import { and, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { game, gameMember } from "@/lib/db/game";
import { notifyUser } from "@/lib/realtime";

// Delete a game — owner only, and only with the game's name typed back as
// confirmation. Members and invites go with it via ON DELETE CASCADE.
export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const [current] = await db
		.select()
		.from(game)
		.where(eq(game.id, id))
		.limit(1);
	if (!current) {
		return NextResponse.json({ error: "game not found" }, { status: 404 });
	}
	if (current.ownerId !== session.user.id) {
		return NextResponse.json(
			{ error: "Only the owner can delete this game." },
			{ status: 403 },
		);
	}

	const body = await request.json().catch(() => null);
	const confirm = typeof body?.name === "string" ? body.name.trim() : "";
	if (confirm !== current.name) {
		return NextResponse.json(
			{ error: "That doesn't match the game's name." },
			{ status: 400 },
		);
	}

	// Collect everyone before the cascade removes the rows we'd read them from.
	const others = await db
		.select({ userId: gameMember.userId })
		.from(gameMember)
		.where(
			and(eq(gameMember.gameId, id), ne(gameMember.userId, session.user.id)),
		);

	await db.delete(game).where(eq(game.id, id));

	for (const member of others) {
		await notifyUser(member.userId, "game:deleted");
	}

	return NextResponse.json({ status: "deleted" });
}
