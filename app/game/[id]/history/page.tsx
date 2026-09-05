import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { ArrowLeftIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { LiveRefresh } from "@/components/live-refresh";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bankSong } from "@/lib/db/bank";
import { game, gameMember } from "@/lib/db/game";
import { guess, round } from "@/lib/db/round";
import { user } from "@/lib/db/schema";
import { trackAsset } from "@/lib/db/track-asset";
import { activeMembership } from "@/lib/games";
import { gameChannel } from "@/lib/realtime";
import { gameDate } from "@/lib/round-date";

export default async function HistoryPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) redirect("/login");
	if (!(await activeMembership(id, session.user.id))) notFound();
	const [current] = await db
		.select()
		.from(game)
		.where(eq(game.id, id))
		.limit(1);
	if (!current) notFound();

	const rounds = await db
		.select({
			id: round.id,
			date: round.roundDate,
			title: trackAsset.title,
			artist: trackAsset.artist,
			artworkUrl: trackAsset.artworkUrl,
			submitter: { id: gameMember.id, name: user.name, image: user.image },
		})
		.from(round)
		.innerJoin(bankSong, eq(round.bankSongId, bankSong.id))
		.innerJoin(trackAsset, eq(bankSong.trackId, trackAsset.id))
		.innerJoin(
			gameMember,
			and(
				eq(gameMember.gameId, round.gameId),
				eq(gameMember.userId, bankSong.userId),
			),
		)
		.innerJoin(user, eq(gameMember.userId, user.id))
		.where(and(eq(round.gameId, id), lt(round.roundDate, gameDate())))
		.orderBy(desc(round.roundDate));
	const guesses = rounds.length
		? await db
				.select({
					roundId: guess.roundId,
					correct: guess.isCorrect,
					name: user.name,
					image: user.image,
				})
				.from(guess)
				.innerJoin(user, eq(guess.guesserUserId, user.id))
				.where(
					inArray(
						guess.roundId,
						rounds.map((item) => item.id),
					),
				)
		: [];
	const byRound = new Map<string, typeof guesses>();
	for (const entry of guesses)
		byRound.set(entry.roundId, [...(byRound.get(entry.roundId) ?? []), entry]);

	return (
		<div className="flex flex-1 flex-col">
			<AppHeader />
			<LiveRefresh channels={[gameChannel(id)]} />
			<main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
				<Link
					href={`/game/${id}`}
					className="flex w-fit items-center gap-1.5 font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground hover:text-foreground"
				>
					<ArrowLeftIcon className="size-3.5" /> {current.name}
				</Link>
				<div>
					<p className="font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
						Answers and guesses
					</p>
					<h1 className="text-4xl font-display tracking-wide uppercase">
						History
					</h1>
				</div>
				{rounds.length === 0 ? (
					<p className="border-2 border-rule p-6 font-mono text-sm text-muted-foreground">
						Past rounds will appear here after the first day closes.
					</p>
				) : (
					<ol className="flex flex-col gap-4">
						{rounds.map((item) => (
							<li key={item.id} className="border-2 border-rule p-4">
								<div className="flex min-w-0 gap-3">
									{item.artworkUrl && (
										// biome-ignore lint/performance/noImgElement: remote iTunes artwork, no next/image benefit
										<img
											src={item.artworkUrl}
											alt=""
											className="size-14 shrink-0 object-cover"
										/>
									)}
									<div className="min-w-0">
										<p className="font-mono text-xs text-muted-foreground">
											{item.date}
										</p>
										<p className="font-bold break-words">{item.title}</p>
										<p className="text-sm break-words text-muted-foreground">
											{item.artist} · submitted by {item.submitter.name}
										</p>
									</div>
								</div>
								<ul className="mt-4 flex flex-col gap-2 border-t-2 border-rule pt-3">
									{(byRound.get(item.id) ?? []).map((entry) => (
										<li
											key={`${item.id}-${entry.name}`}
											className="flex min-w-0 items-center gap-2 text-sm"
										>
											<Avatar className="size-5 shrink-0">
												{entry.image && (
													<AvatarImage src={entry.image} alt={entry.name} />
												)}
												<AvatarFallback>
													{entry.name.charAt(0).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<span className="truncate">{entry.name}</span>
											<span className="ml-auto shrink-0 font-mono text-xs uppercase text-muted-foreground">
												{entry.correct ? "correct" : "fooled"}
											</span>
										</li>
									))}
								</ul>
							</li>
						))}
					</ol>
				)}
			</main>
		</div>
	);
}
