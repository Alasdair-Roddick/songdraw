"use client";

import {
	CheckIcon,
	ChevronDownIcon,
	DoorOpenIcon,
	SparklesIcon,
	XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Vinyl } from "@/components/vinyl";
import { useFeed } from "@/hooks/use-feed";
import type { FeedEntry, MemberView } from "@/lib/round";

export function RoundFeed({ channels }: { channels: string[] }) {
	const { entries, isLoading } = useFeed(channels);

	// One shared <audio> across the whole feed, so scrolling to a new record
	// can't leave two previews overlapping.
	const audioRef = useRef<HTMLAudioElement>(null);
	const [playingId, setPlayingId] = useState<string | null>(null);

	function togglePreview(id: string, url: string | null) {
		const audio = audioRef.current;
		if (!audio || !url) return;
		if (playingId === id) {
			audio.pause();
			setPlayingId(null);
			return;
		}
		audio.src = url;
		audio.play().catch(() => setPlayingId(null));
		setPlayingId(id);
	}

	// Stop audio when the panel playing it scrolls out of view.
	const containerRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const container = containerRef.current;
		if (!container || !playingId) return;

		const observer = new IntersectionObserver(
			(observed) => {
				for (const entry of observed) {
					if (
						entry.target.getAttribute("data-panel") === playingId &&
						!entry.isIntersecting
					) {
						audioRef.current?.pause();
						setPlayingId(null);
					}
				}
			},
			{ root: container, threshold: 0.4 },
		);
		for (const panel of container.querySelectorAll("[data-panel]")) {
			observer.observe(panel);
		}
		return () => observer.disconnect();
	}, [playingId]);

	if (isLoading && entries.length === 0) return null;

	const unguessed = entries.filter(
		(entry) => entry.round.state === "guessing",
	).length;

	return (
		<>
			{/** biome-ignore lint/a11y/useMediaCaption: 30s music preview, not spoken content */}
			<audio
				ref={audioRef}
				onEnded={() => setPlayingId(null)}
				className="hidden"
			/>

			<div
				ref={containerRef}
				className="h-[100dvh] snap-y snap-mandatory overflow-y-scroll overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{entries.length === 0 ? (
					<EmptyPanel />
				) : (
					<>
						{entries.map((entry, index) => (
							<Panel
								key={entry.gameId}
								entry={entry}
								playing={playingId === entry.gameId}
								onTogglePreview={() =>
									togglePreview(
										entry.gameId,
										entry.round.state === "none"
											? null
											: entry.round.track.previewUrl,
									)
								}
								showHint={index === 0 && entries.length > 1}
							/>
						))}
						<DonePanel remaining={unguessed} />
					</>
				)}
			</div>
		</>
	);
}

function Shell({ id, children }: { id?: string; children: React.ReactNode }) {
	return (
		<section
			data-panel={id}
			className="flex h-[100dvh] snap-start snap-always flex-col items-center justify-center gap-6 px-6 py-8"
		>
			{children}
		</section>
	);
}

function Panel({
	entry,
	playing,
	onTogglePreview,
	showHint,
}: {
	entry: FeedEntry;
	playing: boolean;
	onTogglePreview: () => void;
	showHint: boolean;
}) {
	const round = entry.round;
	if (round.state === "none") return null;

	return (
		<Shell id={entry.gameId}>
			<Link
				href={`/game/${entry.gameId}`}
				className="font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground hover:text-foreground"
			>
				{entry.gameName}
			</Link>

			<Vinyl
				artworkUrl={round.track.artworkUrl}
				playing={playing}
				onToggle={onTogglePreview}
				canPlay={!!round.track.previewUrl}
				label={round.track.title}
			/>

			<div className="flex max-w-sm flex-col items-center gap-1 text-center">
				<p className="text-xl font-black tracking-tight">{round.track.title}</p>
				<p className="font-mono text-sm text-muted-foreground">
					{round.track.artist}
				</p>
			</div>

			<div className="w-full max-w-sm">
				{round.state === "guessing" && (
					<GuessBody
						gameId={entry.gameId}
						members={entry.members}
						viewerMemberId={entry.viewerMemberId}
					/>
				)}
				{round.state === "locked" && <LockedBody round={round} />}
				{round.state === "revealed" && <RevealedBody round={round} />}
				{round.state === "submitter" && <SubmitterBody round={round} />}
			</div>

			{showHint && (
				<motion.div
					animate={{ y: [0, 5, 0] }}
					transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY }}
					className="absolute bottom-4 text-muted-foreground motion-reduce:hidden"
				>
					<ChevronDownIcon className="size-5" />
				</motion.div>
			)}
		</Shell>
	);
}

function GuessBody({
	gameId,
	members,
	viewerMemberId,
}: {
	gameId: string;
	members: MemberView[];
	viewerMemberId: string;
}) {
	const router = useRouter();
	const [picked, setPicked] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function lockIn() {
		if (!picked) return;
		setBusy(true);
		setError(null);

		const res = await fetch(`/api/games/${gameId}/round/guess`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ memberId: picked }),
		});
		setBusy(false);

		if (!res.ok) {
			const body = await res.json().catch(() => null);
			setError(body?.error ?? "Couldn't lock that in — try again.");
			return;
		}
		// The broadcast from the server refreshes the feed for everyone,
		// including us — no local mutate needed.
		router.refresh();
	}

	return (
		<div className="flex flex-col gap-3">
			<p className="text-center font-bold tracking-tight">
				Whose song is this?
			</p>
			<ul className="grid grid-cols-2 gap-2">
				{members
					.filter((member) => member.id !== viewerMemberId)
					.map((member) => {
						const isPicked = picked === member.id;
						return (
							<li key={member.id}>
								<motion.button
									type="button"
									whileTap={{ scale: 0.97 }}
									onClick={() => setPicked(member.id)}
									aria-pressed={isPicked}
									className={`flex w-full items-center gap-2 border-2 border-foreground p-2 text-left transition-colors ${
										isPicked
											? "bg-brand text-brand-foreground"
											: "hover:bg-muted"
									}`}
								>
									<Avatar className="size-6">
										{member.image && (
											<AvatarImage src={member.image} alt={member.name} />
										)}
										<AvatarFallback>
											{member.name.charAt(0).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<span className="min-w-0 truncate text-sm font-medium">
										{member.name}
									</span>
								</motion.button>
							</li>
						);
					})}
			</ul>

			{error && (
				<motion.p
					key={error}
					animate={{ x: [0, -6, 6, -3, 3, 0] }}
					transition={{ duration: 0.35 }}
					className="text-center text-sm text-destructive"
				>
					{error}
				</motion.p>
			)}

			<Button
				type="button"
				variant="brand"
				className="h-12 rounded-full text-base"
				disabled={!picked || busy}
				onClick={lockIn}
			>
				{busy ? "Locking in…" : "Lock it in"}
			</Button>
		</div>
	);
}

function LockedBody({
	round,
}: {
	round: Extract<FeedEntry["round"], { state: "locked" }>;
}) {
	return (
		<div className="flex flex-col items-center gap-2 border-2 border-foreground p-4">
			<p className="font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
				Locked in
			</p>
			<div className="flex items-center gap-2">
				<Avatar className="size-6">
					{round.guessed.image && (
						<AvatarImage src={round.guessed.image} alt={round.guessed.name} />
					)}
					<AvatarFallback>
						{round.guessed.name.charAt(0).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<span className="font-bold">{round.guessed.name}</span>
			</div>
			<p className="text-center font-mono text-sm text-muted-foreground">
				{round.waitingOn > 0
					? `Waiting on ${round.waitingOn} more — answer at 5pm.`
					: "Answer unlocking…"}
			</p>
		</div>
	);
}

function RevealedBody({
	round,
}: {
	round: Extract<FeedEntry["round"], { state: "revealed" }>;
}) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			className="flex flex-col gap-3 border-2 border-foreground p-4"
		>
			<div className="flex items-center gap-2">
				<span
					className={`grid size-6 place-items-center rounded-full ${
						round.correct
							? "bg-brand text-brand-foreground"
							: "bg-foreground text-background"
					}`}
				>
					{round.correct ? (
						<CheckIcon className="size-3.5" />
					) : (
						<XIcon className="size-3.5" />
					)}
				</span>
				<p className="text-lg font-black tracking-tight uppercase">
					{round.correct ? "Got it" : "Nope"}
				</p>
				{round.points > 0 && (
					<span className="ml-auto font-mono text-sm font-bold tabular-nums">
						+{round.points}
					</span>
				)}
			</div>
			<div className="flex items-center gap-2.5">
				<Avatar>
					{round.answer.image && (
						<AvatarImage src={round.answer.image} alt={round.answer.name} />
					)}
					<AvatarFallback>
						{round.answer.name.charAt(0).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<p className="text-sm">
					It was <span className="font-bold">{round.answer.name}</span>
					{!round.correct && round.guessed && (
						<span className="text-muted-foreground">
							{" "}
							— you said {round.guessed.name}
						</span>
					)}
				</p>
			</div>
		</motion.div>
	);
}

function SubmitterBody({
	round,
}: {
	round: Extract<FeedEntry["round"], { state: "submitter" }>;
}) {
	return (
		<div className="flex flex-col gap-3 border-2 border-foreground p-4">
			<div className="flex items-center justify-between gap-3">
				<p className="font-black tracking-tight uppercase">Your song 👀</p>
				<motion.span
					key={round.fooled}
					initial={{ scale: 1.3 }}
					animate={{ scale: 1 }}
					transition={{ type: "spring", stiffness: 400, damping: 22 }}
					className="font-mono text-sm font-bold tabular-nums"
				>
					{round.fooled} fooled
				</motion.span>
			</div>
			{round.guesses.length === 0 ? (
				<p className="font-mono text-sm text-muted-foreground">
					Nobody's guessed yet.
				</p>
			) : (
				<ul className="flex flex-col gap-2">
					<AnimatePresence initial={false}>
						{round.guesses.map((row) => (
							<motion.li
								key={row.name}
								initial={{ opacity: 0, x: -8 }}
								animate={{ opacity: 1, x: 0 }}
								className="flex items-center justify-between gap-2"
							>
								<div className="flex min-w-0 items-center gap-2">
									<Avatar className="size-6">
										{row.image && (
											<AvatarImage src={row.image} alt={row.name} />
										)}
										<AvatarFallback>
											{row.name.charAt(0).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<span className="truncate text-sm font-medium">
										{row.name}
									</span>
								</div>
								<span className="shrink-0 font-mono text-xs tracking-widest uppercase text-muted-foreground">
									{row.correct ? "got it" : "fooled"}
								</span>
							</motion.li>
						))}
					</AnimatePresence>
				</ul>
			)}
			{round.waitingOn > 0 && (
				<p className="font-mono text-xs text-muted-foreground">
					{round.waitingOn} still to guess.
				</p>
			)}
		</div>
	);
}

function DonePanel({ remaining }: { remaining: number }) {
	const done = remaining === 0;
	return (
		<Shell>
			<motion.div
				initial={{ scale: 0.85, opacity: 0 }}
				whileInView={{ scale: 1, opacity: 1 }}
				viewport={{ once: false, amount: 0.6 }}
				transition={{ type: "spring", stiffness: 260, damping: 20 }}
				className="flex flex-col items-center gap-4 text-center"
			>
				<motion.span
					animate={done ? { rotate: [0, -8, 8, 0] } : {}}
					transition={{
						duration: 1.2,
						repeat: Number.POSITIVE_INFINITY,
						repeatDelay: 1.5,
					}}
					className="grid size-16 place-items-center rounded-full border-2 border-foreground bg-brand text-brand-foreground motion-reduce:animate-none"
				>
					<SparklesIcon className="size-7" />
				</motion.span>

				<h2 className="text-3xl font-black tracking-tighter uppercase leading-[0.95]">
					{done ? "All songs guessed" : `${remaining} still to guess`}
				</h2>
				<p className="max-w-xs font-mono text-sm text-muted-foreground">
					{done
						? "Bank a song for tomorrow's pool — it's your ticket to being played."
						: "Scroll back up and finish the rest."}
				</p>

				{done && (
					<Button
						asChild
						variant="brand"
						className="h-12 rounded-full text-base"
					>
						<Link href="/bank">
							<DoorOpenIcon />
							Bank a song
						</Link>
					</Button>
				)}
			</motion.div>
		</Shell>
	);
}

function EmptyPanel() {
	return (
		<Shell>
			<div className="flex flex-col items-center gap-3 text-center">
				<h2 className="text-3xl font-black tracking-tighter uppercase leading-[0.95]">
					Nothing playing
				</h2>
				<p className="max-w-xs font-mono text-sm text-muted-foreground">
					No round today. Rounds are drawn at midnight once a room has 3 members
					and a song in the pool.
				</p>
				<Button asChild variant="outline" className="rounded-full">
					<Link href="/rooms">
						<DoorOpenIcon />
						Your rooms
					</Link>
				</Button>
			</div>
		</Shell>
	);
}
