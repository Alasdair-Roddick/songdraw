import { and, desc, eq } from "drizzle-orm";
import { ArrowLeftIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { DailyRound } from "@/components/daily-round";
import { DeleteGameDialog } from "@/components/delete-game-dialog";
import { InviteMemberDialog } from "@/components/invite-member-dialog";
import { MemberList } from "@/components/member-list";
import { PendingInvites } from "@/components/pending-invites";
import { SongPool } from "@/components/song-pool";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { game, gameInvite, gameMember } from "@/lib/db/game";
import { guess, round } from "@/lib/db/round";
import { user } from "@/lib/db/schema";
import { submission } from "@/lib/db/submission";
import { trackAsset } from "@/lib/db/track-asset";
import { MIN_MEMBERS, SEATS } from "@/lib/game-rules";
import { activeMembership } from "@/lib/games";
import { gameDate } from "@/lib/round-date";

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

	const isOwner = current.ownerId === session.user.id;
	const needed = MIN_MEMBERS - members.length;

	// Your pool only. Answer secrecy starts here — no query on this page ever
	// reaches another member's submissions, so there's nothing to leak.
	const myPool = await db
		.select({
			id: submission.id,
			title: trackAsset.title,
			artist: trackAsset.artist,
			artworkUrl: trackAsset.artworkUrl,
			previewUrl: trackAsset.previewUrl,
		})
		.from(submission)
		.innerJoin(trackAsset, eq(submission.trackId, trackAsset.id))
		.where(
			and(
				eq(submission.gameId, id),
				eq(submission.memberId, viewerMembership.id),
				eq(submission.status, "pooled"),
			),
		)
		.orderBy(desc(submission.submittedAt));

	// M4-5, mirrored in the UI. The server enforces this on every POST; this
	// only decides whether the button is offered.
	const [todaysRound] = await db
		.select({ id: round.id, submitterMemberId: submission.memberId })
		.from(round)
		.innerJoin(submission, eq(round.submissionId, submission.id))
		.where(and(eq(round.gameId, id), eq(round.roundDate, gameDate())))
		.limit(1);

	let mustPlayFirst = false;
	if (todaysRound && todaysRound.submitterMemberId !== viewerMembership.id) {
		const [played] = await db
			.select({ id: guess.id })
			.from(guess)
			.where(
				and(
					eq(guess.roundId, todaysRound.id),
					eq(guess.guesserUserId, session.user.id),
				),
			)
			.limit(1);
		mustPlayFirst = !played;
	}

	return (
		<div className="flex flex-1 flex-col">
			<AppHeader />
			<main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-6 py-8">
				<div className="flex flex-col gap-5">
					<Link
						href="/home"
						className="flex w-fit items-center gap-1.5 font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground hover:text-foreground"
					>
						<ArrowLeftIcon className="size-3.5" />
						All games
					</Link>

					<div className="flex flex-wrap items-center justify-between gap-3">
						<h1 className="text-4xl font-black tracking-tighter uppercase leading-[0.95]">
							{current.name}
						</h1>
						<InviteMemberDialog gameId={id} />
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

				<DailyRound gameId={id} members={members} viewerId={session.user.id} />

				<SongPool
					gameId={id}
					songs={myPool}
					locked={needed > 0}
					needed={needed}
					mustPlayFirst={mustPlayFirst}
				/>

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
