"use client";

import {
	LockIcon,
	MusicIcon,
	PauseIcon,
	PlayIcon,
	PlusIcon,
	XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
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

export type PooledSong = {
	id: string;
	title: string;
	artist: string;
	artworkUrl: string | null;
	previewUrl: string | null;
};

export function SongPool({
	gameId,
	songs,
	locked,
	needed,
	mustPlayFirst,
}: {
	gameId: string;
	songs: PooledSong[];
	locked: boolean;
	needed: number;
	/** M4-5: a round is open and you haven't guessed yet. */
	mustPlayFirst: boolean;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [playingId, setPlayingId] = useState<string | null>(null);
	const [removing, setRemoving] = useState<string | null>(null);
	const audioRef = useRef<HTMLAudioElement>(null);

	function togglePreview(song: PooledSong) {
		const audio = audioRef.current;
		if (!audio || !song.previewUrl) return;

		if (playingId === song.id) {
			audio.pause();
			setPlayingId(null);
			return;
		}
		// One shared <audio>: starting a preview stops whatever was playing.
		audio.src = song.previewUrl;
		audio.play();
		setPlayingId(song.id);
	}

	async function add(track: Track) {
		setOpen(false);

		const res = await fetch(`/api/games/${gameId}/submissions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(track),
		});

		if (!res.ok) {
			const body = await res.json().catch(() => null);
			toast.error(body?.error ?? "Couldn't bank that song — try again.");
			return;
		}
		toast.success(`Banked ${track.title}`);
		router.refresh();
	}

	async function remove(song: PooledSong) {
		setRemoving(song.id);
		if (playingId === song.id) {
			audioRef.current?.pause();
			setPlayingId(null);
		}

		const res = await fetch(`/api/games/${gameId}/submissions/${song.id}`, {
			method: "DELETE",
		});
		setRemoving(null);

		if (!res.ok) {
			toast.error("Couldn't remove that song — try again.");
			return;
		}
		router.refresh();
	}

	return (
		<section className="flex flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex flex-col gap-0.5">
					<h2 className="font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
						Your pool · {songs.length}
					</h2>
					<p className="font-mono text-xs text-muted-foreground">
						Only you can see these.
					</p>
				</div>

				{locked ? (
					<span className="flex items-center gap-1.5 font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
						<LockIcon className="size-3.5" />
						{needed} more to unlock
					</span>
				) : mustPlayFirst ? (
					<span className="flex items-center gap-1.5 font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
						<LockIcon className="size-3.5" />
						Guess today's song first
					</span>
				) : (
					<Dialog open={open} onOpenChange={setOpen}>
						<DialogTrigger asChild>
							<Button type="button" variant="brand" className="rounded-full">
								<PlusIcon />
								Bank a song
							</Button>
						</DialogTrigger>
						<DialogContent className="max-h-[85vh] overflow-y-auto rounded-none border-2 border-foreground sm:max-w-lg">
							<DialogHeader>
								<DialogTitle>Bank a song</DialogTitle>
								<DialogDescription>
									Nobody sees it until it's drawn. Pick something that frames
									someone else.
								</DialogDescription>
							</DialogHeader>
							<SongSearch onConfirm={add} />
						</DialogContent>
					</Dialog>
				)}
			</div>

			{/** biome-ignore lint/a11y/useMediaCaption: 30s music preview, not spoken content */}
			<audio
				ref={audioRef}
				onEnded={() => setPlayingId(null)}
				className="hidden"
			/>

			{songs.length === 0 ? (
				<div className="flex flex-col items-center gap-1 border-2 border-foreground p-10 text-center">
					<MusicIcon className="mb-1 size-5 text-muted-foreground" />
					<p className="font-bold tracking-tight">Nothing banked yet</p>
					<p className="font-mono text-sm text-muted-foreground">
						{locked
							? "Your pool opens once the game has enough players."
							: "Bank a few — one gets drawn at random on your day."}
					</p>
				</div>
			) : (
				<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
					<AnimatePresence mode="popLayout">
						{songs.map((song) => (
							<motion.li
								key={song.id}
								layout
								exit={{ opacity: 0, scale: 0.9 }}
								transition={{ type: "spring", stiffness: 400, damping: 22 }}
								className="group relative flex min-w-0 flex-col border-2 border-foreground"
							>
								<div className="relative aspect-square border-b-2 border-foreground bg-muted">
									{song.artworkUrl ? (
										// biome-ignore lint/performance/noImgElement: remote iTunes artwork, no next/image benefit
										<img
											src={song.artworkUrl}
											alt=""
											className="size-full object-cover"
										/>
									) : (
										<div className="flex size-full items-center justify-center">
											<MusicIcon className="size-6 text-muted-foreground" />
										</div>
									)}

									{song.previewUrl && (
										<button
											type="button"
											onClick={() => togglePreview(song)}
											aria-label={
												playingId === song.id
													? `Pause ${song.title}`
													: `Play ${song.title}`
											}
											className="absolute inset-0 flex items-center justify-center bg-foreground/0 opacity-0 transition-all group-hover:bg-foreground/40 group-hover:opacity-100 focus-visible:bg-foreground/40 focus-visible:opacity-100 data-[playing=true]:bg-foreground/40 data-[playing=true]:opacity-100"
											data-playing={playingId === song.id}
										>
											<span className="flex size-10 items-center justify-center rounded-full border-2 border-foreground bg-brand text-brand-foreground">
												{playingId === song.id ? (
													<PauseIcon className="size-4" />
												) : (
													<PlayIcon className="size-4" />
												)}
											</span>
										</button>
									)}

									<Button
										type="button"
										variant="ghost"
										size="icon-sm"
										aria-label={`Remove ${song.title}`}
										disabled={removing === song.id}
										onClick={() => remove(song)}
										className="absolute top-1 right-1 border-2 border-foreground bg-background opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
									>
										<XIcon />
									</Button>
								</div>

								<div className="flex flex-col gap-0.5 p-2.5">
									<span className="truncate text-sm font-bold tracking-tight">
										{song.title}
									</span>
									<span className="truncate font-mono text-xs text-muted-foreground">
										{song.artist}
									</span>
								</div>
							</motion.li>
						))}
					</AnimatePresence>
				</ul>
			)}
		</section>
	);
}
