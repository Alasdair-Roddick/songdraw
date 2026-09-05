"use client";

import { Music2Icon, PlusIcon, XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { SongSearch } from "@/components/song-search";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import type { Track } from "@/lib/music/types";

export function BankSongDialog({
	onBanked,
	trigger,
}: {
	onBanked?: (track: Track) => void;
	trigger?: ReactNode;
}) {
	const [open, setOpen] = useState(false);
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
		onBanked?.(track);
		setOpen(false);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) setError(null);
			}}
		>
			<DialogTrigger asChild>
				{trigger ?? (
					<Button type="button" size="sm">
						<PlusIcon /> Bank a song
					</Button>
				)}
			</DialogTrigger>
			<DialogContent
				showCloseButton={false}
				className="top-auto bottom-0 left-0 h-[min(46rem,calc(100dvh-1rem))] max-w-none translate-x-0 translate-y-0 gap-0 overflow-hidden rounded-t-2xl border-2 border-rule p-0 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:h-[min(46rem,calc(100dvh-3rem))] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl"
			>
				<DialogHeader className="relative border-b-2 border-rule bg-brand p-5 pr-14 text-brand-foreground">
					<div className="flex items-center gap-3">
						<span className="grid size-10 place-items-center rounded-full border-2 border-rule bg-background text-foreground">
							<Music2Icon className="size-5" />
						</span>
						<div>
							<DialogTitle className="text-xl font-display font-extrabold tracking-tight">
								Bank a song
							</DialogTitle>
							<DialogDescription className="text-brand-foreground/75">
								Private until draw day. Make it count.
							</DialogDescription>
						</div>
					</div>
					<DialogClose asChild>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="absolute top-4 right-4 text-brand-foreground hover:bg-brand-foreground/15 hover:text-brand-foreground"
						>
							<XIcon />
							<span className="sr-only">Close</span>
						</Button>
					</DialogClose>
				</DialogHeader>
				<div className="min-h-0 overflow-y-auto p-4 sm:p-5">
					<SongSearch onConfirm={bank} />
					{error && <p className="mt-3 text-sm text-destructive">{error}</p>}
				</div>
			</DialogContent>
		</Dialog>
	);
}
