import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { RoundFeed } from "@/components/round-feed";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameMember } from "@/lib/db/game";
import { gameChannel, userChannel } from "@/lib/realtime";

// The play surface. Deliberately chrome-free — no header, no nav — so a round
// fills the screen and scrolling moves between rooms rather than around a page.
// Everything else lives under /rooms.
export default async function HomePage() {
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

	// Channel names are derived server-side and handed down, so a browser can
	// only ever listen to rooms it actually belongs to.
	const channels = [
		userChannel(session.user.id),
		...memberships.map((m) => gameChannel(m.gameId)),
	];

	return <RoundFeed channels={channels} />;
}
