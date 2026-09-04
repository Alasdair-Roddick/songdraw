import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { RoundFeed } from "@/components/round-feed";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { gameMember } from "@/lib/db/game";
import { gameChannel, userChannel } from "@/lib/realtime";

// The play surface: today's round from every room you're in, ordered so the
// ones still wanting a guess come first. It used to be a full-screen snap
// carousel, which meant the page owned your scroll and you had to page through
// rooms to find the one you owed — it's a plain list now, and carries the
// normal header since it no longer needs the whole viewport.
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

	return (
		<div className="flex flex-1 flex-col">
			<AppHeader />
			<RoundFeed channels={channels} />
		</div>
	);
}
