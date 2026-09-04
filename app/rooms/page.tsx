import { and, count, eq, inArray } from "drizzle-orm";
import { ChevronRightIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { CreateGameDialog } from "@/components/create-game-dialog";
import { LiveRefresh } from "@/components/live-refresh";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { game, gameMember } from "@/lib/db/game";
import { MIN_MEMBERS, SEATS } from "@/lib/game-rules";
import { gameChannel, userChannel } from "@/lib/realtime";

export default async function RoomsPage() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) redirect("/login");

	const games = await db
		.select({ game, role: gameMember.role })
		.from(gameMember)
		.innerJoin(game, eq(gameMember.gameId, game.id))
		.where(
			and(
				eq(gameMember.userId, session.user.id),
				eq(gameMember.status, "active"),
			),
		);

	// One grouped count instead of a query per game — the roster size drives
	// the "locked / live" state on every card.
	const ids = games.map(({ game: g }) => g.id);
	const counts = ids.length
		? await db
				.select({ gameId: gameMember.gameId, members: count() })
				.from(gameMember)
				.where(
					and(inArray(gameMember.gameId, ids), eq(gameMember.status, "active")),
				)
				.groupBy(gameMember.gameId)
		: [];
	const memberCount = new Map(counts.map((c) => [c.gameId, c.members]));
	// The personal channel catches a newly accepted invite, removal, deletion,
	// or a game made in another tab. The per-game channels keep roster counts
	// and ownership labels current for every room already on this screen.
	const channels = [
		userChannel(session.user.id),
		...games.map(({ game: current }) => gameChannel(current.id)),
	];

	return (
		<div className="flex flex-1 flex-col">
			<AppHeader />
			<LiveRefresh channels={channels} />
			<main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div className="flex flex-col gap-1">
						<h1 className="text-4xl font-display tracking-wide uppercase leading-[0.95]">
							Your{" "}
							<span className="-rotate-1 inline-block bg-brand px-3 text-brand-foreground">
								rooms
							</span>
						</h1>
						<p className="font-mono text-sm text-muted-foreground">
							{games.length === 0
								? "Nothing yet."
								: `${games.length} room${games.length > 1 ? "s" : ""}`}
						</p>
					</div>
					<CreateGameDialog />
				</div>

				{games.length === 0 ? (
					<div className="flex flex-col items-center gap-1 border-2 border-foreground p-10 text-center">
						<p className="font-bold tracking-tight">No rooms yet</p>
						<p className="font-mono text-sm text-muted-foreground">
							Create one, then invite your friends by name.
						</p>
					</div>
				) : (
					<ul className="divide-y-2 divide-foreground border-2 border-foreground">
						{games.map(({ game: g, role }) => {
							const members = memberCount.get(g.id) ?? 1;
							const needed = MIN_MEMBERS - members;

							return (
								<li key={g.id}>
									<Link
										href={`/game/${g.id}`}
										className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-brand hover:text-brand-foreground"
									>
										<div className="flex min-w-0 flex-col gap-1">
											<span className="truncate text-lg font-bold tracking-tight">
												{g.name}
											</span>
											<span className="font-mono text-xs tracking-widest uppercase opacity-70">
												{members} member{members === 1 ? "" : "s"}
												{role === "owner" && " · owner"}
											</span>
										</div>
										<div className="flex shrink-0 items-center gap-3">
											{/* Seat meter mirrors the game page, so "how close are we"
											    reads the same in both places. */}
											<div className="hidden gap-1 sm:flex">
												{SEATS.map((seat, i) => (
													<div
														key={seat}
														className={`h-2.5 w-5 border-2 border-current ${
															i < members ? "bg-current" : "bg-transparent"
														}`}
													/>
												))}
											</div>
											<span className="font-mono text-xs font-semibold tracking-widest uppercase">
												{needed > 0 ? `${needed} to unlock` : "Live"}
											</span>
											<ChevronRightIcon className="size-4" />
										</div>
									</Link>
								</li>
							);
						})}
					</ul>
				)}
			</main>
		</div>
	);
}
