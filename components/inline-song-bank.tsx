"use client";

import { CheckIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { SongSearch } from "@/components/song-search";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import type { Track } from "@/lib/music/types";

export function InlineSongBank() {
	const [open, setOpen] = useState(false);
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
		setOpen(false);
	}

	return (
		<div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-foreground pt-3">
			{saved ? (
				<p className="flex items-center gap-2 font-mono text-sm font-semibold">
					<CheckIcon className="size-4 text-brand" /> {saved} is banked.
				</p>
			) : (
				<p className="font-mono text-xs text-muted-foreground">
					Queue up a future round.
				</p>
			)}
			<Dialog
				open={open}
				onOpenChange={(next) => {
					setOpen(next);
					if (next) setError(null);
				}}
			>
				<DialogTrigger asChild>
					<Button type="button" size="sm">
						<PlusIcon /> Bank a song
					</Button>
				</DialogTrigger>
				<DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>Bank a song</DialogTitle>
						<DialogDescription>
							Pick a song for a future round. It stays private until it is
							drawn.
						</DialogDescription>
					</DialogHeader>
					<SongSearch onConfirm={bank} />
					{error && <p className="text-sm text-destructive">{error}</p>}
				</DialogContent>
			</Dialog>
		</div>
	);
}
