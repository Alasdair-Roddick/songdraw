import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { SongBank } from "@/components/song-bank";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameMember } from "@/lib/db/game";
import { gameChannel, userChannel } from "@/lib/realtime";

export default async function BankPage() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) redirect("/login");

	const memberships = await db
		.select({ gameId: gameMember.gameId })
		.from(gameMember)
		.where(
			and(
				eq(gameMember.userId, session.user.id),
				eq(gameMember.status, "active"),
			),
		);

	// A guess in any room can unlock banking, so the bank listens to them all.
	const channels = [
		userChannel(session.user.id),
		...memberships.map((m) => gameChannel(m.gameId)),
	];

	return (
		<div className="flex flex-1 flex-col">
			<AppHeader />
			<main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
				<SongBank channels={channels} />
			</main>
		</div>
	);
}
