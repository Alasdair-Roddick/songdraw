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
import { useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { BankSongDialog } from "@/components/bank-song-dialog";
import { Button } from "@/components/ui/button";
import { useRealtimeSignal } from "@/hooks/use-realtime";

type BankSong = {
	id: string;
	title: string;
	artist: string;
	artworkUrl: string | null;
	previewUrl: string | null;
};

type BankResponse = { songs: BankSong[]; outstanding: number };

const fetcher = (url: string) =>
	fetch(url).then((res) => {
		if (!res.ok) throw new Error("failed to load bank");
		return res.json();
	});

/**
 * One bank per person, shared by every game they're in. It isn't scoped to a
 * game because the draw isn't either — it picks a member, then one of their
 * songs that the *particular* game hasn't played yet.
 */
export function SongBank({ channels }: { channels: string[] }) {
	const { data, mutate } = useSWR<BankResponse>("/api/bank", fetcher, {
		refreshInterval: 60_000,
		revalidateOnFocus: true,
		keepPreviousData: true,
	});

	// A guess anywhere can unlock banking, so listen to every game too.
	useRealtimeSignal(channels, () => {
		mutate();
	});

	const [playingId, setPlayingId] = useState<string | null>(null);
	const [removing, setRemoving] = useState<string | null>(null);
	const audioRef = useRef<HTMLAudioElement>(null);

	const songs = data?.songs ?? [];
	const outstanding = data?.outstanding ?? 0;
	const locked = outstanding > 0;

	function togglePreview(song: BankSong) {
		const audio = audioRef.current;
		if (!audio || !song.previewUrl) return;
		if (playingId === song.id) {
			audio.pause();
			setPlayingId(null);
			return;
		}
		audio.src = song.previewUrl;
		audio.play().catch(() => setPlayingId(null));
		setPlayingId(song.id);
	}

	async function remove(song: BankSong) {
		setRemoving(song.id);
		if (playingId === song.id) {
			audioRef.current?.pause();
			setPlayingId(null);
		}
		const res = await fetch(`/api/bank/${song.id}`, { method: "DELETE" });
		setRemoving(null);
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			toast.error(body?.error ?? "Couldn't remove that song — try again.");
			return;
		}
		mutate();
	}

	return (
		<section className="flex flex-col gap-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div className="flex flex-col gap-1">
					<h1 className="text-4xl font-black tracking-tighter uppercase leading-[0.95]">
						Song{" "}
						<span className="-rotate-1 inline-block bg-brand px-3 text-brand-foreground">
							bank
						</span>
					</h1>
					<p className="font-mono text-sm text-muted-foreground">
						{songs.length === 0
							? "Empty."
							: `${songs.length} song${songs.length === 1 ? "" : "s"} · used by every room you're in`}
					</p>
				</div>

				{locked ? (
					<span className="flex items-center gap-1.5 font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
						<LockIcon className="size-3.5" />
						{outstanding} left to guess
					</span>
				) : (
					<BankSongDialog
						onBanked={(track) => {
							toast.success(`Banked ${track.title}`);
							mutate();
						}}
						trigger={
							<Button
								type="button"
								variant="brand"
								className="h-12 rounded-full text-base"
							>
								<PlusIcon />
								Bank a song
							</Button>
						}
					/>
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
							? "Guess today's songs first, then bank one."
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
											data-playing={playingId === song.id}
											className="absolute inset-0 flex items-center justify-center opacity-0 transition-all group-hover:bg-foreground/40 group-hover:opacity-100 focus-visible:bg-foreground/40 focus-visible:opacity-100 data-[playing=true]:bg-foreground/40 data-[playing=true]:opacity-100"
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
