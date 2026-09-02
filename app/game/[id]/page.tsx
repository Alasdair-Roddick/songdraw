import { and, count, eq } from "drizzle-orm";
import { ArrowLeftIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { DeleteGameDialog } from "@/components/delete-game-dialog";
import { DevPanel } from "@/components/dev-panel";
import { GameInsights } from "@/components/game-insights";
import { GameRulesDialog } from "@/components/game-rules-dialog";
import { InviteMemberDialog } from "@/components/invite-member-dialog";
import { LiveRefresh } from "@/components/live-refresh";
import { MemberList } from "@/components/member-list";
import { PendingInvites } from "@/components/pending-invites";
import { PoolHealth } from "@/components/pool-health";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bankSong } from "@/lib/db/bank";
import { game, gameInvite, gameMember } from "@/lib/db/game";
import { user } from "@/lib/db/schema";
import { isDevMode } from "@/lib/dev-mode";
import { gameInsights } from "@/lib/game-insights";
import { MIN_MEMBERS, SEATS } from "@/lib/game-rules";
import { activeMembership } from "@/lib/games";
import { gameChannel } from "@/lib/realtime";

export default async function GamePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) redirect("/login");

	// Non-members get a 404, not a 403 — a game's existence isn't public.
	const viewerMembership = await activeMembership(id, session.user.id);
	if (!viewerMembership) notFound();

	const [current] = await db
		.select()
		.from(game)
		.where(eq(game.id, id))
		.limit(1);
	if (!current) notFound();

	const members = await db
		.select({
			id: gameMember.id,
			role: gameMember.role,
			user: { id: user.id, name: user.name, image: user.image },
		})
		.from(gameMember)
		.innerJoin(user, eq(gameMember.userId, user.id))
		.where(and(eq(gameMember.gameId, id), eq(gameMember.status, "active")));

	const pending = await db
		.select({
			id: gameInvite.id,
			invitee: { id: user.id, name: user.name, image: user.image },
		})
		.from(gameInvite)
		.innerJoin(user, eq(gameInvite.inviteeId, user.id))
		.where(and(eq(gameInvite.gameId, id), eq(gameInvite.status, "pending")));

	const [poolRows, insights] = await Promise.all([
		db
			.select({ userId: gameMember.userId, bankedSongs: count(bankSong.id) })
			.from(gameMember)
			.leftJoin(
				bankSong,
				and(
					eq(bankSong.userId, gameMember.userId),
					eq(bankSong.status, "banked"),
				),
			)
			.where(and(eq(gameMember.gameId, id), eq(gameMember.status, "active")))
			.groupBy(gameMember.userId),
		gameInsights(id),
	]);

	const isOwner = current.ownerId === session.user.id;
	const needed = MIN_MEMBERS - members.length;
	const totalSongs = poolRows.reduce(
		(total, row) => total + row.bankedSongs,
		0,
	);
	const membersWithoutSongs = poolRows.filter(
		(row) => row.bankedSongs === 0,
	).length;
	const viewerSongs =
		poolRows.find((row) => row.userId === session.user.id)?.bankedSongs ?? 0;
	const fullyCoveredRounds =
		poolRows.length > 0
			? Math.min(...poolRows.map((row) => row.bankedSongs))
			: 0;

	return (
		<div className="flex flex-1 flex-col">
			{/* Roster, invites and pool all re-render when anyone changes them. */}
			<LiveRefresh channels={[gameChannel(id)]} />
			<AppHeader />
			<main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-8">
				<div className="flex flex-col gap-5">
					<Link
						href="/rooms"
						className="flex w-fit items-center gap-1.5 font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground hover:text-foreground"
					>
						<ArrowLeftIcon className="size-3.5" />
						All rooms
					</Link>

					<div className="flex flex-wrap items-center justify-between gap-3">
						<h1 className="text-4xl font-black tracking-tighter uppercase leading-[0.95]">
							{current.name}
						</h1>
						<div className="flex items-center gap-3">
							<GameRulesDialog />
							<Link
								href={`/game/${id}/leaderboard`}
								className="font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground hover:text-foreground"
							>
								Leaderboard
							</Link>
							<Link
								href={`/game/${id}/history`}
								className="font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground hover:text-foreground"
							>
								History
							</Link>
							<InviteMemberDialog gameId={id} />
						</div>
					</div>

					{/* Three blocks, one per seat — the unlock rule as a picture. */}
					<div className="flex flex-col gap-2.5 border-2 border-foreground p-4">
						<div className="flex items-center justify-between gap-3">
							<span className="font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
								{needed > 0 ? "Locked" : "Unlocked"}
							</span>
							<span className="font-mono text-xs font-semibold tracking-widest uppercase tabular-nums">
								{Math.min(members.length, MIN_MEMBERS)} / {MIN_MEMBERS}
							</span>
						</div>
						<div className="flex gap-1.5">
							{SEATS.map((seat, i) => (
								<div
									key={seat}
									className={`h-3 flex-1 border-2 border-foreground ${
										i < members.length ? "bg-brand" : "bg-transparent"
									}`}
								/>
							))}
						</div>
						<p className="font-mono text-sm text-muted-foreground">
							{needed > 0
								? `Invite ${needed} more ${needed === 1 ? "person" : "people"} to start the daily round.`
								: "First round drops at midnight."}
						</p>
					</div>
				</div>

				<PoolHealth
					totalSongs={totalSongs}
					membersWithoutSongs={membersWithoutSongs}
					viewerSongs={viewerSongs}
					fullyCoveredRounds={fullyCoveredRounds}
				/>

				{/* Never renders in production; the route it calls 404s there too. */}
				{isDevMode() && <DevPanel gameId={id} />}

				<section className="flex flex-col gap-3">
					<h2 className="font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
						Members · {members.length}
					</h2>
					<MemberList
						gameId={id}
						members={members}
						viewerId={session.user.id}
						viewerIsOwner={isOwner}
					/>
				</section>

				{pending.length > 0 && (
					<section className="flex flex-col gap-3">
						<h2 className="font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
							Awaiting reply · {pending.length}
						</h2>
						<PendingInvites invites={pending} />
					</section>
				)}

				<GameInsights insights={insights} />

				{isOwner && (
					<section className="mt-auto flex flex-col gap-3">
						<h2 className="font-mono text-xs font-semibold tracking-widest uppercase text-destructive">
							Danger zone
						</h2>
						<DeleteGameDialog gameId={id} gameName={current.name} />
					</section>
				)}
			</main>
		</div>
	);
}
