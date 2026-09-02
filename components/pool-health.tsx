import { BatteryChargingIcon, CircleAlertIcon } from "lucide-react";

export function PoolHealth({
	totalSongs,
	membersWithoutSongs,
	viewerSongs,
	fullyCoveredRounds,
}: {
	totalSongs: number;
	membersWithoutSongs: number;
	viewerSongs: number;
	fullyCoveredRounds: number;
}) {
	const needsSongs = membersWithoutSongs > 0;
	return (
		<section className="flex flex-col gap-3">
			<h2 className="font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
				Pool health
			</h2>
			<div className="flex flex-col gap-3 border-2 border-foreground p-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-start gap-3">
					{needsSongs ? (
						<CircleAlertIcon className="mt-0.5 size-5 text-brand" />
					) : (
						<BatteryChargingIcon className="mt-0.5 size-5 text-brand" />
					)}
					<div>
						<p className="font-bold">
							{totalSongs} song{totalSongs === 1 ? "" : "s"} ready
						</p>
						<p className="font-mono text-sm text-muted-foreground">
							{needsSongs
								? `${membersWithoutSongs} member${membersWithoutSongs === 1 ? " needs" : "s need"} to bank a song.`
								: `Everyone is covered for about ${fullyCoveredRounds} round${fullyCoveredRounds === 1 ? "" : "s"}.`}
						</p>
					</div>
				</div>
				<p className="font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
					You: {viewerSongs} banked
				</p>
			</div>
		</section>
	);
}
