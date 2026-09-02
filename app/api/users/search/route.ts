import { and, eq, ilike, ne, notInArray } from "drizzle-orm";
import { headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameInvite, gameMember } from "@/lib/db/game";
import { user } from "@/lib/db/schema";
import { activeMembership } from "@/lib/games";

const MIN_QUERY = 2;
const LIMIT = 8;

// Typeahead for "invite someone by name". Display names aren't unique, so
// results carry an avatar to tell two Daves apart — but never an email, which
// would turn this into an address-harvesting endpoint.
export async function GET(request: NextRequest) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
	const gameId = request.nextUrl.searchParams.get("gameId")?.trim() ?? "";
	if (q.length < MIN_QUERY || !gameId) {
		return NextResponse.json([]);
	}

	// Only members can enumerate people to invite into a game.
	if (!(await activeMembership(gameId, session.user.id))) {
		return NextResponse.json({ error: "not a member" }, { status: 403 });
	}

	const members = await db
		.select({ userId: gameMember.userId })
		.from(gameMember)
		.where(and(eq(gameMember.gameId, gameId), eq(gameMember.status, "active")));

	const pending = await db
		.select({ inviteeId: gameInvite.inviteeId })
		.from(gameInvite)
		.where(
			and(eq(gameInvite.gameId, gameId), eq(gameInvite.status, "pending")),
		);

	const excluded = members.map((m) => m.userId);
	const pendingIds = new Set(pending.map((p) => p.inviteeId));

	const rows = await db
		.select({ id: user.id, name: user.name, image: user.image })
		.from(user)
		.where(
			and(
				ilike(user.name, `%${q}%`),
				ne(user.id, session.user.id),
				excluded.length > 0 ? notInArray(user.id, excluded) : undefined,
			),
		)
		.limit(LIMIT);

	// Already-invited people stay in the list, flagged, so the inviter sees
	// "Invited" rather than wondering why the person vanished from search.
	return NextResponse.json(
		rows.map((row) => ({ ...row, invited: pendingIds.has(row.id) })),
	);
}
