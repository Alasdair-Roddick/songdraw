"use client";

import {
	ArrowRightIcon,
	CheckIcon,
	LoaderCircleIcon,
	PlayIcon,
	SearchIcon,
	SearchXIcon,
	XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Track } from "@/lib/music/types";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 300;

const EQ_BARS = [
	{ delay: "0s", duration: "0.9s" },
	{ delay: "-0.4s", duration: "1.1s" },
	{ delay: "-0.7s", duration: "0.8s" },
];

const SKELETON_ROWS = [0, 1, 2, 3];

export function SongSearch({
	onConfirm,
}: {
	onConfirm?: (track: Track) => void;
}) {
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [results, setResults] = useState<Track[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [playingId, setPlayingId] = useState<string | null>(null);
	const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
	const [progress, setProgress] = useState(0);
	const audioRef = useRef<HTMLAudioElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	// Debounce: wait for typing to pause before firing a request.
	useEffect(() => {
		const timeout = setTimeout(
			() => setDebouncedQuery(query.trim()),
			DEBOUNCE_MS,
		);
		return () => clearTimeout(timeout);
	}, [query]);

	useEffect(() => {
		if (!debouncedQuery) {
			setResults([]);
			setError(null);
			return;
		}

		const controller = new AbortController();
		setLoading(true);
		setError(null);

		fetch(`/api/music/search?query=${encodeURIComponent(debouncedQuery)}`, {
			signal: controller.signal,
		})
			.then((res) => {
				if (!res.ok) throw new Error("Search failed");
				return res.json() as Promise<Track[]>;
			})
			.then(setResults)
			.catch((err) => {
				if (err instanceof Error && err.name !== "AbortError") {
					setError("Couldn't search — try again.");
				}
			})
			.finally(() => setLoading(false));

		return () => controller.abort();
	}, [debouncedQuery]);

	function togglePreview(track: Track) {
		const audio = audioRef.current;
		if (!audio || !track.previewUrl) return;

		if (playingId === track.providerTrackId) {
			audio.pause();
			setPlayingId(null);
			setProgress(0);
			return;
		}

		// One shared <audio> element — starting a new preview naturally stops
		// whatever was already playing instead of overlapping sound.
		audio.src = track.previewUrl;
		audio.play();
		setPlayingId(track.providerTrackId);
		setProgress(0);
	}

	function select(track: Track) {
		// Tapping the selected track again deselects it.
		setSelectedTrack((current) =>
			current?.providerTrackId === track.providerTrackId ? null : track,
		);
	}

	function handleConfirm() {
		if (!selectedTrack) return;
		audioRef.current?.pause();
		setPlayingId(null);
		setProgress(0);

		// Caching is this component's job, not each caller's — every consumer
		// of SongSearch gets it for free.
		fetch("/api/tracks", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(selectedTrack),
		});

		onConfirm?.(selectedTrack);
	}

	const showSkeletons = loading && results.length === 0 && !!debouncedQuery;
	const showEmpty =
		!loading && debouncedQuery && results.length === 0 && !error;

	return (
		<div className="flex flex-col gap-3">
			<div className="relative">
				<SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					ref={inputRef}
					placeholder="Search for a song…"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					autoFocus
					className="h-12 rounded-full pr-11 pl-10 text-base"
				/>
				{loading ? (
					<LoaderCircleIcon className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
				) : (
					query && (
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
							aria-label="Clear search"
							onClick={() => {
								setQuery("");
								inputRef.current?.focus();
							}}
						>
							<XIcon />
						</Button>
					)
				)}
			</div>
			{/** biome-ignore lint/a11y/useMediaCaption: 30s music preview, not spoken content */}
			<audio
				ref={audioRef}
				onEnded={() => {
					setPlayingId(null);
					setProgress(0);
				}}
				onTimeUpdate={() => {
					const audio = audioRef.current;
					if (audio?.duration) setProgress(audio.currentTime / audio.duration);
				}}
				className="hidden"
			/>

			{error && (
				<motion.p
					key={error}
					animate={{ x: [0, -6, 6, -3, 3, 0] }}
					transition={{ duration: 0.35 }}
					className="text-sm text-destructive"
				>
					{error}
				</motion.p>
			)}

			{showSkeletons && (
				<div className="flex flex-col divide-y-2 divide-foreground border-2 border-foreground">
					{SKELETON_ROWS.map((row) => (
						<div key={row} className="flex items-center gap-3 p-2.5">
							<div
								className="size-12 shrink-0 animate-pulse bg-muted"
								style={{ animationDelay: `${row * 120}ms` }}
							/>
							<div className="flex min-w-0 flex-1 flex-col gap-2">
								<div
									className="h-3.5 w-2/5 animate-pulse bg-muted"
									style={{ animationDelay: `${row * 120}ms` }}
								/>
								<div
									className="h-3 w-3/5 animate-pulse bg-muted"
									style={{ animationDelay: `${row * 120 + 60}ms` }}
								/>
							</div>
						</div>
					))}
				</div>
			)}

			{showEmpty && (
				<motion.div
					initial={{ opacity: 0, y: 6 }}
					animate={{ opacity: 1, y: 0 }}
					className="flex flex-col items-center gap-2 py-8 text-muted-foreground"
				>
					<SearchXIcon className="size-6" />
					<p className="font-mono text-sm">No matches for “{debouncedQuery}”</p>
				</motion.div>
			)}

			<ScrollArea
				className={cn(
					"max-h-[420px]",
					results.length > 5 &&
						"[mask-image:linear-gradient(to_bottom,black_calc(100%-2.5rem),transparent)]",
				)}
			>
				<div className="flex flex-col divide-y-2 divide-foreground border-2 border-foreground">
					{results.map((track, i) => {
						const isSelected =
							selectedTrack?.providerTrackId === track.providerTrackId;
						const isPlaying = playingId === track.providerTrackId;
						return (
							<motion.div
								key={track.providerTrackId}
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.15 }}
								whileTap={{ scale: 0.98 }}
								role="button"
								tabIndex={0}
								onClick={() => select(track)}
								onKeyDown={(e) => {
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										select(track);
									}
								}}
								className={cn(
									"group flex cursor-pointer items-center gap-3 p-2.5 text-left transition-colors hover:bg-muted",
									isSelected && "bg-brand text-brand-foreground hover:bg-brand",
								)}
							>
								<button
									type="button"
									disabled={!track.previewUrl}
									onClick={(e) => {
										e.stopPropagation();
										togglePreview(track);
									}}
									aria-label={isPlaying ? "Pause preview" : "Play preview"}
									className="relative size-14 shrink-0 overflow-hidden outline-none focus-visible:ring-3 focus-visible:ring-brand/60"
								>
									{track.artworkUrl ? (
										// biome-ignore lint/performance/noImgElement: remote iTunes artwork, no next/image benefit
										<img
											src={track.artworkUrl}
											alt=""
											className="size-14 object-cover transition-transform duration-300 group-hover:scale-110"
										/>
									) : (
										<div className="size-14 bg-muted" />
									)}
									{isPlaying ? (
										<div className="absolute inset-0 flex items-end justify-center gap-0.5 bg-black/50 px-4 py-3">
											{EQ_BARS.map((bar) => (
												<span
													key={bar.delay + bar.duration}
													className="h-full w-1 origin-bottom animate-[equalize_1s_ease-in-out_infinite] rounded-full bg-white motion-reduce:animate-none"
													style={{
														animationDelay: bar.delay,
														animationDuration: bar.duration,
													}}
												/>
											))}
										</div>
									) : (
										track.previewUrl && (
											<div className="absolute inset-0 grid place-items-center bg-black/25">
												<PlayIcon className="size-5 fill-white text-white drop-shadow" />
											</div>
										)
									)}
									{isPlaying && (
										<div
											className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-white"
											style={{ transform: `scaleX(${progress})` }}
										/>
									)}
								</button>
								<div className="min-w-0 flex-1">
									<p className="truncate font-medium">{track.title}</p>
									<p
										className={cn(
											"truncate text-sm",
											isSelected
												? "text-brand-foreground/70"
												: "text-muted-foreground",
										)}
									>
										{track.artist}
										{track.album ? ` · ${track.album}` : ""}
									</p>
								</div>
								{isSelected && (
									<motion.div
										initial={{ scale: 0.5, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{
											type: "spring",
											stiffness: 400,
											damping: 22,
										}}
										className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-foreground text-brand"
									>
										<CheckIcon className="size-3" />
									</motion.div>
								)}
							</motion.div>
						);
					})}
				</div>
			</ScrollArea>

			<AnimatePresence>
				{selectedTrack && (
					<motion.div
						initial={{ y: 16, opacity: 0 }}
						animate={{ y: 0, opacity: 1 }}
						exit={{ y: 16, opacity: 0 }}
						transition={{ type: "spring", stiffness: 400, damping: 30 }}
						className="sticky bottom-4 z-10"
					>
						<div className="flex items-center gap-3 border-2 border-foreground bg-background p-2.5 shadow-[4px_4px_0_0_var(--color-foreground)]">
							{selectedTrack.artworkUrl ? (
								// biome-ignore lint/performance/noImgElement: remote iTunes artwork, no next/image benefit
								<img
									src={selectedTrack.artworkUrl}
									alt=""
									className="size-10 shrink-0 object-cover"
								/>
							) : (
								<div className="size-10 shrink-0 bg-muted" />
							)}
							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium">
									{selectedTrack.title}
								</p>
								<p className="truncate text-xs text-muted-foreground">
									{selectedTrack.artist}
								</p>
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								className="shrink-0 text-muted-foreground"
								aria-label="Clear selection"
								onClick={() => setSelectedTrack(null)}
							>
								<XIcon />
							</Button>
							<Button
								type="button"
								variant="brand"
								className="h-10 rounded-full"
								onClick={handleConfirm}
							>
								Continue
								<ArrowRightIcon />
							</Button>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
