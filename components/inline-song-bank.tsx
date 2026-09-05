"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { BankSongDialog } from "@/components/bank-song-dialog";
import type { Track } from "@/lib/music/types";

export function InlineSongBank() {
	const [saved, setSaved] = useState<string | null>(null);

	return (
		<div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-rule pt-3">
			{saved ? (
				<p className="flex items-center gap-2 font-mono text-sm font-semibold">
					<CheckIcon className="size-4 text-brand" /> {saved} is banked.
				</p>
			) : (
				<p className="font-mono text-xs text-muted-foreground">
					Queue up a future round.
				</p>
			)}
			<BankSongDialog onBanked={(track: Track) => setSaved(track.title)} />
		</div>
	);
}
