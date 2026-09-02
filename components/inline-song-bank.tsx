"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { SongSearch } from "@/components/song-search";
import type { Track } from "@/lib/music/types";

export function InlineSongBank() {
	const [saved, setSaved] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function bank(track: Track) {
		setError(null);
		const response = await fetch("/api/bank", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(track),
		});
		if (!response.ok) {
			const body = await response.json().catch(() => null);
			setError(body?.error ?? "Couldn't bank that song — try again.");
			return;
		}
		setSaved(track.title);
	}

	if (saved) {
		return (
			<p className="flex items-center gap-2 border-2 border-foreground bg-brand p-3 font-mono text-sm font-semibold">
				<CheckIcon className="size-4" /> {saved} is in your bank.
			</p>
		);
	}

	return (
		<div className="border-2 border-foreground p-3">
			<p className="mb-3 font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
				Bank one for a future round
			</p>
			<SongSearch onConfirm={bank} />
			{error && <p className="mt-2 text-sm text-destructive">{error}</p>}
		</div>
	);
}
