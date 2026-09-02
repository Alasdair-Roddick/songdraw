import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { gameMember } from "@/lib/db/game";

// Active membership is the authorisation boundary for everything game-scoped:
// only members may see a game's roster, its pending invites, or invite anyone
// into it. A "left" member is not a member.
export async function activeMembership(gameId: string, userId: string) {
	const [row] = await db
		.select()
		.from(gameMember)
		.where(
			and(
				eq(gameMember.gameId, gameId),
				eq(gameMember.userId, userId),
				eq(gameMember.status, "active"),
			),
		)
		.limit(1);

	return row ?? null;
}
