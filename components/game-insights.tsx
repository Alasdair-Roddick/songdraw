import { BrainIcon, SparklesIcon } from "lucide-react";
import type { GameInsights as GameInsightsData } from "@/lib/game-insights";

export function GameInsights({ insights }: { insights: GameInsightsData }) {
	if (!insights.mostFooledPair && !insights.hardestSong) return null;

	return (
		<section className="flex flex-col gap-3">
			<h2 className="font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
				Room lore
			</h2>
			<div className="grid gap-3 sm:grid-cols-2">
				{insights.mostFooledPair && (
					<div className="flex gap-3 border-2 border-foreground p-4">
						<BrainIcon className="mt-0.5 size-5 shrink-0 text-brand" />
						<p className="text-sm leading-relaxed">
							<span className="font-bold">
								{insights.mostFooledPair.submitter}
							</span>
							's songs are most often mistaken for{" "}
							<span className="font-bold">
								{insights.mostFooledPair.guessed}
							</span>
							{insights.mostFooledPair.times > 1 &&
								` · ${insights.mostFooledPair.times} times`}
							.
						</p>
					</div>
				)}
				{insights.hardestSong && (
					<div className="flex gap-3 border-2 border-foreground p-4">
						<SparklesIcon className="mt-0.5 size-5 shrink-0 text-brand" />
						<p className="text-sm leading-relaxed">
							Hardest so far:{" "}
							<span className="font-bold">{insights.hardestSong.title}</span>
							{" by "}
							{insights.hardestSong.artist} · {insights.hardestSong.correct}/
							{insights.hardestSong.total} got it.
						</p>
					</div>
				)}
			</div>
		</section>
	);
}
