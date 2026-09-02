import { and, eq } from "drizzle-orm";
import { ArrowLeftIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { InviteMemberDialog } from "@/components/invite-member-dialog";
import { PendingInvites } from "@/components/pending-invites";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { game, gameInvite, gameMember } from "@/lib/db/game";
import { user } from "@/lib/db/schema";
import { activeMembership } from "@/lib/games";

const MIN_MEMBERS = 3;

export default async function GamePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) redirect("/login");

	// Non-members get a 404, not a 403 — a game's existence isn't public.
	if (!(await activeMembership(id, session.user.id))) notFound();

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

	const needed = MIN_MEMBERS - members.length;

	return (
		<div className="flex flex-1 flex-col">
			<AppHeader />
			<main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-8">
				<div className="flex flex-col gap-4">
					<Link
						href="/home"
						className="flex w-fit items-center gap-1.5 font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground hover:text-foreground"
					>
						<ArrowLeftIcon className="size-3.5" />
						All games
					</Link>
					<div className="flex flex-wrap items-center justify-between gap-3">
						<h1 className="text-3xl font-black tracking-tight uppercase">
							{current.name}
						</h1>
						<InviteMemberDialog gameId={id} />
					</div>
					{needed > 0 ? (
						<p className="border-2 border-foreground bg-brand px-3 py-2 font-mono text-sm font-semibold text-brand-foreground">
							Invite {needed} more {needed === 1 ? "person" : "people"} to
							unlock the daily round.
						</p>
					) : (
						<p className="font-mono text-sm text-muted-foreground">
							First round drops at midnight.
						</p>
					)}
				</div>

				<section className="flex flex-col gap-3">
					<h2 className="font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
						Members · {members.length}
					</h2>
					<ul className="divide-y-2 divide-foreground border-2 border-foreground">
						{members.map((member) => (
							<li
								key={member.id}
								className="flex items-center justify-between gap-3 p-3"
							>
								<div className="flex min-w-0 items-center gap-2.5">
									<Avatar>
										{member.user.image && (
											<AvatarImage
												src={member.user.image}
												alt={member.user.name}
											/>
										)}
										<AvatarFallback>
											{member.user.name.charAt(0).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<span className="truncate font-medium">
										{member.user.name}
									</span>
								</div>
								{member.role === "owner" && (
									<span className="shrink-0 font-mono text-xs tracking-widest uppercase text-muted-foreground">
										Owner
									</span>
								)}
							</li>
						))}
					</ul>
				</section>

				{pending.length > 0 && (
					<section className="flex flex-col gap-3">
						<h2 className="font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
							Awaiting reply · {pending.length}
						</h2>
						<PendingInvites invites={pending} />
					</section>
				)}
			</main>
		</div>
	);
}
