import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { submission } from "@/lib/db/submission";
import { activeMembership } from "@/lib/games";

// Un-bank a song. Only your own, and only while it's still pooled — once a
// track has been played it's part of the game's history, not your inventory.
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string; submissionId: string }> },
) {
	const { id: gameId, submissionId } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const membership = await activeMembership(gameId, session.user.id);
	if (!membership) {
		return NextResponse.json({ error: "not a member" }, { status: 403 });
	}

	const deleted = await db
		.delete(submission)
		.where(
			and(
				eq(submission.id, submissionId),
				eq(submission.gameId, gameId),
				// Scoping to the caller's own member row is what keeps one player
				// from clearing out another's pool.
				eq(submission.memberId, membership.id),
				eq(submission.status, "pooled"),
			),
		)
		.returning({ id: submission.id });

	if (deleted.length === 0) {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}

	return NextResponse.json({ status: "removed" });
}
