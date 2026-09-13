import { eq } from "drizzle-orm";
import { ArrowLeftIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { LiveRefresh } from "@/components/live-refresh";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { game } from "@/lib/db/game";
import { type LeaderboardPeriod, leaderboardForGame } from "@/lib/game-stats";
import { activeMembership } from "@/lib/games";
import { gameChannel } from "@/lib/realtime";
import { hasLiveRoundToday } from "@/lib/settled-rounds";

// One grid template for the header and the rows. Below `sm` the rows drop out
// of the grid entirely and re-form as a stacked block, which is why the table
// element had to go: a table can't reflow, so it could only ever scroll.
const COLUMNS =
	"sm:grid sm:grid-cols-[1fr_4.5rem_5.5rem_4.5rem_4.5rem_4.5rem] sm:items-center sm:gap-3";

function Stat({
	label,
	value,
	strong,
}: {
	label: string;
	value: string | number;
	strong?: boolean;
}) {
	return (
		<div className="sm:text-right">
			<span className="block font-mono text-[10px] tracking-widest uppercase text-muted-foreground sm:hidden">
				{label}
			</span>
			<span className={`font-mono tabular-nums ${strong ? "font-bold" : ""}`}>
				{value}
			</span>
		</div>
	);
}

const periods: { value: LeaderboardPeriod; label: string }[] = [
	{ value: "day", label: "Today" },
	{ value: "week", label: "This week" },
	{ value: "all", label: "All time" },
];

export default async function LeaderboardPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ period?: string }>;
}) {
	const [{ id }, { period: requested }] = await Promise.all([
		params,
		searchParams,
	]);
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) redirect("/login");
	if (!(await activeMembership(id, session.user.id))) notFound();

	const [current] = await db
		.select()
		.from(game)
		.where(eq(game.id, id))
		.limit(1);
	if (!current) notFound();
	const period: LeaderboardPeriod =
		requested === "day" || requested === "week" || requested === "all"
			? requested
			: "all";
	const [rows, liveToday] = await Promise.all([
		leaderboardForGame(id, period),
		hasLiveRoundToday(id),
	]);

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
						This room only
					</p>
					<h1 className="text-4xl font-display font-extrabold tracking-tight">
						Leaderboard
					</h1>
				</div>
				<nav
					className="flex w-full border-2 border-rule sm:w-fit"
					aria-label="Leaderboard period"
				>
					{periods.map((option) => (
						<Link
							key={option.value}
							href={`/game/${id}/leaderboard?period=${option.value}`}
							className={`flex-1 border-r-2 border-rule px-3 py-3 text-center font-mono text-xs font-semibold uppercase last:border-r-0 sm:flex-none sm:py-2 ${
								period === option.value
									? "bg-brand text-brand-foreground"
									: "hover:bg-muted"
							}`}
						>
							{option.label}
						</Link>
					))}
				</nav>
				{liveToday && period === "day" ? (
					// Today's board is derived entirely from today's guesses, so while
					// the round is live there is nothing to show that wouldn't name the
					// submitter — a rising fool-point total is the answer.
					<div className="flex flex-col gap-2 border-2 border-rule p-6">
						<p className="font-display text-2xl font-extrabold tracking-tight">
							Locked until the reveal
						</p>
						<p className="font-mono text-sm text-muted-foreground">
							Today's scores would give away whose song is playing. This board
							opens once everyone has guessed, or at 5pm.
						</p>
					</div>
				) : (
					<>
						{liveToday && (
							<p className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
								Today's round isn't counted yet
							</p>
						)}
						<div className="border-2 border-rule">
							<div
								className={`hidden border-b-2 border-rule px-3 py-2 font-mono text-xs tracking-widest uppercase text-muted-foreground ${COLUMNS}`}
							>
								<span>Player</span>
								<span className="text-right">Points</span>
								<span className="text-right">Accuracy</span>
								<span className="text-right">Fooled</span>
								<span className="text-right">Bonus</span>
								<span className="text-right">Streak</span>
							</div>
							<ul className="divide-y-2 divide-rule">
								{rows.map((row, index) => (
									<li
										key={row.memberId}
										className={`px-3 py-3 ${COLUMNS} ${
											index === 0 && rows.length > 1 ? "bg-brand/30" : ""
										}`}
									>
										<div className="flex min-w-0 items-center gap-2">
											<span className="w-5 shrink-0 font-mono text-xs text-muted-foreground">
												{index + 1}
											</span>
											<Avatar className="size-7 shrink-0">
												{row.image && (
													<AvatarImage src={row.image} alt={row.name} />
												)}
												<AvatarFallback>
													{row.name.charAt(0).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<span className="truncate font-semibold">{row.name}</span>
										</div>
										{/* `sm:contents` promotes these four back into the row grid on
								    wide screens; on mobile they stay a labelled 4-up strip. */}
										<div className="mt-2 grid grid-cols-5 gap-2 sm:contents">
											<Stat label="Points" value={row.points} strong />
											<Stat
												label="Accuracy"
												value={
													row.total
														? `${Math.round((row.correct / row.total) * 100)}%`
														: "—"
												}
											/>
											<Stat label="Fooled" value={row.foolPoints} />
											<Stat label="Bonus" value={row.bonusPoints} />
											<Stat label="Streak" value={row.currentStreak} />
										</div>
									</li>
								))}
							</ul>
						</div>
					</>
				)}
			</main>
		</div>
	);
}
