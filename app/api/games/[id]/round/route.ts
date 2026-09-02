import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { activeMembership } from "@/lib/games";
import { roundViewFor } from "@/lib/round";

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id: gameId } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const membership = await activeMembership(gameId, session.user.id);
	if (!membership) {
		return NextResponse.json({ error: "not a member" }, { status: 403 });
	}

	// All secrecy logic lives in roundViewFor — see lib/round.ts.
	const view = await roundViewFor(gameId, session.user.id, membership.id);
	return NextResponse.json(view);
}
