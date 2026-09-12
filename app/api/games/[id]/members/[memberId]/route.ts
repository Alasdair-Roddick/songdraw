import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendWakeups } from "@/lib/daily-job";
import { db } from "@/lib/db";
import { activeMembership } from "@/lib/games";
import { removeMember } from "@/lib/moderation";
import { MutationError } from "@/lib/mutation";

// Remove a member. The owner may remove anyone else; anyone may remove
// themselves (that's "leave"). Nobody may remove the owner — transferring
// ownership first is the only way out for them, which keeps every game owned.
export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string; memberId: string }> },
) {
	const { id: gameId, memberId } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	if (!(await activeMembership(gameId, session.user.id))) {
		return NextResponse.json({ error: "not a member" }, { status: 403 });
	}

	try {
		const target = await db.transaction((tx) =>
			removeMember(tx, gameId, memberId, session.user.id),
		);
		const isSelf = target.userId === session.user.id;
		await sendWakeups([
			{
				kind: "user",
				id: target.userId,
				event: isSelf ? "game:left" : "game:removed",
			},
			{ kind: "game", id: gameId, event: "game:members" },
		]);
		return NextResponse.json({ status: isSelf ? "left" : "removed" });
	} catch (error) {
		if (error instanceof MutationError)
			return NextResponse.json(
				{ error: error.message },
				{ status: error.status },
			);
		throw error;
	}
}
