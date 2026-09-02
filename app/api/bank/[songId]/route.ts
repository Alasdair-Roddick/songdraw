import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bankSong } from "@/lib/db/bank";
import { round } from "@/lib/db/round";

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ songId: string }> },
) {
	const { songId } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	// A song some game has already played belongs to that game's history now —
	// its round points at this row, so it stops being yours to withdraw.
	const [played] = await db
		.select({ id: round.id })
		.from(round)
		.where(eq(round.bankSongId, songId))
		.limit(1);
	if (played) {
		return NextResponse.json(
			{ error: "That one's already been played — it stays." },
			{ status: 409 },
		);
	}

	const deleted = await db
		.delete(bankSong)
		// Scoping to the caller is what stops one player emptying another's bank.
		.where(and(eq(bankSong.id, songId), eq(bankSong.userId, session.user.id)))
		.returning({ id: bankSong.id });

	if (deleted.length === 0) {
		return NextResponse.json({ error: "not found" }, { status: 404 });
	}
	return NextResponse.json({ status: "removed" });
}
