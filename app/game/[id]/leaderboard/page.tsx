import { eq } from "drizzle-orm";
import { ArrowLeftIcon } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { game } from "@/lib/db/game";
import { type LeaderboardPeriod, leaderboardForGame } from "@/lib/game-stats";
import { activeMembership } from "@/lib/games";

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
	const rows = await leaderboardForGame(id, period);

	return (
		<div className="flex flex-1 flex-col">
			<AppHeader />
			<main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-8">
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
					<h1 className="text-4xl font-black tracking-tighter uppercase">
						Leaderboard
					</h1>
				</div>
				<nav
					className="flex w-fit border-2 border-foreground"
					aria-label="Leaderboard period"
				>
					{periods.map((option) => (
						<Link
							key={option.value}
							href={`/game/${id}/leaderboard?period=${option.value}`}
							className={`border-r-2 border-foreground px-3 py-2 font-mono text-xs font-semibold uppercase last:border-r-0 ${
								period === option.value
									? "bg-brand text-brand-foreground"
									: "hover:bg-muted"
							}`}
						>
							{option.label}
						</Link>
					))}
				</nav>
				<div className="overflow-x-auto border-2 border-foreground">
					<table className="w-full min-w-[620px] text-left">
						<thead className="border-b-2 border-foreground font-mono text-xs tracking-widest uppercase text-muted-foreground">
							<tr>
								<th className="p-3">Player</th>
								<th className="p-3 text-right">Points</th>
								<th className="p-3 text-right">Accuracy</th>
								<th className="p-3 text-right">Fooled</th>
								<th className="p-3 text-right">Streak</th>
							</tr>
						</thead>
						<tbody className="divide-y-2 divide-foreground">
							{rows.map((row, index) => (
								<tr
									key={row.memberId}
									className={
										index === 0 && rows.length > 1 ? "bg-brand/30" : ""
									}
								>
									<td className="p-3">
										<div className="flex items-center gap-2">
											<span className="w-5 font-mono text-xs text-muted-foreground">
												{index + 1}
											</span>
											<Avatar className="size-7">
												{row.image && (
													<AvatarImage src={row.image} alt={row.name} />
												)}
												<AvatarFallback>
													{row.name.charAt(0).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<span className="font-semibold">{row.name}</span>
										</div>
									</td>
									<td className="p-3 text-right font-mono font-bold tabular-nums">
										{row.points}
									</td>
									<td className="p-3 text-right font-mono tabular-nums">
										{row.total
											? `${Math.round((row.correct / row.total) * 100)}%`
											: "—"}
									</td>
									<td className="p-3 text-right font-mono tabular-nums">
										{row.foolPoints}
									</td>
									<td className="p-3 text-right font-mono tabular-nums">
										{row.currentStreak}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</main>
		</div>
	);
}
