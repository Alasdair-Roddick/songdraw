import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { game, gameMember } from "@/lib/db/game";
import { MAX_GAME_NAME } from "@/lib/game-rules";
import { notifyUser } from "@/lib/realtime";

export async function POST(request: Request) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	// Unguarded, this threw on a malformed body and surfaced as a 500.
	const body = await request.json().catch(() => null);
	const name = typeof body?.name === "string" ? body.name.trim() : "";
	if (!name) {
		return NextResponse.json({ error: "name is required" }, { status: 400 });
	}
	// Unbounded before: any length was persisted and then rendered as a heading.
	if (name.length > MAX_GAME_NAME) {
		return NextResponse.json(
			{ error: `Keep the name under ${MAX_GAME_NAME} characters.` },
			{ status: 400 },
		);
	}

	const created = await db.transaction(async (tx) => {
		const [newGame] = await tx
			.insert(game)
			.values({ name, ownerId: session.user.id })
			.returning();

		await tx.insert(gameMember).values({
			gameId: newGame.id,
			userId: session.user.id,
			role: "owner",
		});

		return newGame;
	});

	// Keep another open rooms tab in sync with the newly created game.
	await notifyUser(session.user.id, "game:created");

	return NextResponse.json(created);
}

export async function GET() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const rows = await db
		.select({ game, role: gameMember.role })
		.from(gameMember)
		.innerJoin(game, eq(gameMember.gameId, game.id))
		// `status` matters as much as `userId`. Removal is soft (the row stays with
		// status "left"), so without this a removed member keeps seeing the room's
		// name, id and owner here — while every other membership query in the app
		// correctly filters them out.
		.where(
			and(
				eq(gameMember.userId, session.user.id),
				eq(gameMember.status, "active"),
			),
		);

	return NextResponse.json(
		rows.map((row) => ({ ...row.game, role: row.role })),
	);
}
