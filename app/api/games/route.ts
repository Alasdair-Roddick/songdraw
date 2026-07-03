import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { game, gameMember } from "@/lib/db/game";

export async function POST(request: Request) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const body = await request.json();
	const name = typeof body?.name === "string" ? body.name.trim() : "";
	if (!name) {
		return NextResponse.json({ error: "name is required" }, { status: 400 });
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
		.where(eq(gameMember.userId, session.user.id));

	return NextResponse.json(
		rows.map((row) => ({ ...row.game, role: row.role })),
	);
}
