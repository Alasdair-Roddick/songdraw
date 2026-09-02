import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { game, gameInvite } from "@/lib/db/game";
import { user } from "@/lib/db/schema";

// The bell's data source. Authed and scoped to the caller, which is what lets
// the Realtime channel stay a contentless ping — see lib/realtime.ts.
export async function GET() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const rows = await db
		.select({
			id: gameInvite.id,
			createdAt: gameInvite.createdAt,
			game: { id: game.id, name: game.name },
			inviter: { id: user.id, name: user.name, image: user.image },
		})
		.from(gameInvite)
		.innerJoin(game, eq(gameInvite.gameId, game.id))
		.innerJoin(user, eq(gameInvite.inviterId, user.id))
		.where(
			and(
				eq(gameInvite.inviteeId, session.user.id),
				eq(gameInvite.status, "pending"),
			),
		)
		.orderBy(desc(gameInvite.createdAt));

	return NextResponse.json(rows);
}
