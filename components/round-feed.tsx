"use client";

import {
	CheckIcon,
	ClockIcon,
	DoorOpenIcon,
	SparklesIcon,
	XIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { InlineSongBank } from "@/components/inline-song-bank";
import { ShareResult } from "@/components/share-result";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Vinyl } from "@/components/vinyl";
import { useFeed } from "@/hooks/use-feed";
import type { FeedEntry, MemberView } from "@/lib/round";

export function RoundFeed({ channels }: { channels: string[] }) {
	const { entries, isLoading, applyRound } = useFeed(channels);

	// Rounds that flipped to revealed while this tab was open get the full
	// reveal animation; ones already revealed on first load just render.
	//
	// The transition is detected during render rather than in an effect. Holding
	// the previous states in state (not a ref) keeps that comparison idempotent
	// under StrictMode's double render, and React re-runs the render before
	// committing — so there is no cascading update to warn about.
	const stateKey = entries
		.map((entry) => `${entry.gameId}:${entry.round.state}`)
		.join("|");
	const [seenKey, setSeenKey] = useState(stateKey);
	const [justRevealed, setJustRevealed] = useState<Set<string>>(new Set());

	if (stateKey !== seenKey) {
		const before = new Map(
			seenKey
				.split("|")
				.filter(Boolean)
				.map((pair) => {
					const split = pair.lastIndexOf(":");
					return [pair.slice(0, split), pair.slice(split + 1)] as const;
				}),
		);
		const fresh = entries
			.filter((entry) => {
				const prior = before.get(entry.gameId);
				return (
					prior && prior !== "revealed" && entry.round.state === "revealed"
				);
			})
			.map((entry) => entry.gameId);

		setSeenKey(stateKey);
		if (fresh.length > 0) {
			setJustRevealed((current) => new Set([...current, ...fresh]));
		}
	}

	// Let the animation play, then fall back to the resting layout. The state
	// update lives in the timeout callback, so nothing is set synchronously
	// while the effect body runs.
	useEffect(() => {
		if (justRevealed.size === 0) return;
		const timer = setTimeout(() => setJustRevealed(new Set()), 2600);
		return () => clearTimeout(timer);
	}, [justRevealed]);

	// One shared <audio> across the whole feed, so scrolling to a new record
	// can't leave two previews overlapping.
	const audioRef = useRef<HTMLAudioElement>(null);
	const [playingId, setPlayingId] = useState<string | null>(null);

	// Scopes the audio observer to this feed's cards.
	const containerRef = useRef<HTMLDivElement>(null);

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
	useEffect(() => {
		if (!playingId) return;

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
			// Document scroll now, so no `root` — the viewport is the root.
			{ threshold: 0.4 },
		);
		const container = containerRef.current;
		if (!container) return;
		for (const panel of container.querySelectorAll("[data-panel]")) {
			observer.observe(panel);
		}
		return () => observer.disconnect();
	}, [playingId]);

	if (isLoading && entries.length === 0) return null;

	const unguessed = entries.filter(
		(entry) => entry.round.state === "guessing",
	).length;

	// Anything still wanting a guess floats up. With the full-screen snap gone
	// there is no "scroll to find the one you owe" — the actionable rooms are
	// simply at the top. Ties keep the server's order so cards don't reshuffle
	// under a thumb mid-scroll.
	const ordered = [...entries].sort((a, b) => {
		const aOwed = a.round.state === "guessing" ? 0 : 1;
		const bOwed = b.round.state === "guessing" ? 0 : 1;
		return aOwed - bOwed;
	});

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
				className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6 sm:px-6"
			>
				{entries.length === 0 ? (
					<EmptyPanel />
				) : (
					<>
						<FeedHeading remaining={unguessed} total={entries.length} />
						{ordered.map((entry, index) => (
							<Panel
								key={entry.gameId}
								entry={entry}
								index={index}
								justRevealed={justRevealed.has(entry.gameId)}
								onGuessed={applyRound}
								playing={playingId === entry.gameId}
								onTogglePreview={() =>
									togglePreview(
										entry.gameId,
										entry.round.state === "none"
											? null
											: entry.round.track.previewUrl,
									)
								}
							/>
						))}
						<DonePanel remaining={unguessed} index={entries.length} />
					</>
				)}
			</div>
		</>
	);
}

/**
 * Replaces the old fixed progress rail: with every card in one normal scroll
 * there is nothing to indicate position, but "how many do I still owe" was the
 * genuinely useful half of that rail.
 */
function FeedHeading({
	remaining,
	total,
}: {
	remaining: number;
	total: number;
}) {
	return (
		<div className="flex items-baseline justify-between gap-3 pt-1">
			<h1 className="text-2xl font-display tracking-wide uppercase">Today</h1>
			<span className="font-mono text-xs font-semibold tracking-widest uppercase tabular-nums text-muted-foreground">
				{remaining > 0 ? `${remaining} to guess` : `${total} done`}
			</span>
		</div>
	);
}

function Shell({
	id,
	index,
	children,
}: {
	id?: string;
	index: number;
	children: React.ReactNode;
}) {
	return (
		<motion.section
			data-panel={id}
			data-index={index}
			initial={{ opacity: 0, y: 12 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{
				delay: Math.min(index, 4) * 0.06,
				type: "spring",
				stiffness: 300,
				damping: 26,
			}}
			className="relative flex flex-col items-center gap-6 border-2 border-foreground bg-background px-4 py-8 shadow-[4px_4px_0_0_var(--color-foreground)] sm:px-6"
		>
			{children}
		</motion.section>
	);
}

function Panel({
	entry,
	index,
	justRevealed,
	onGuessed,
	playing,
	onTogglePreview,
}: {
	entry: FeedEntry;
	index: number;
	justRevealed: boolean;
	onGuessed: (gameId: string, round: FeedEntry["round"]) => void;
	playing: boolean;
	onTogglePreview: () => void;
}) {
	const round = entry.round;
	if (round.state === "none") return null;

	return (
		<Shell id={entry.gameId} index={index}>
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
				{/* Stays on the sans: Bebas has no lowercase, and a song title is
				    the artist's casing, not ours to flatten. */}
				<p className="text-xl font-bold tracking-tight">{round.track.title}</p>
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
						onGuessed={onGuessed}
					/>
				)}
				{round.state === "locked" && <LockedBody round={round} />}
				{round.state === "revealed" && (
					<RevealedBody round={round} justRevealed={justRevealed} />
				)}
				{round.state === "submitter" && <SubmitterBody round={round} />}
			</div>
		</Shell>
	);
}

function GuessBody({
	gameId,
	members,
	viewerMemberId,
	onGuessed,
}: {
	gameId: string;
	members: MemberView[];
	viewerMemberId: string;
	onGuessed: (gameId: string, round: FeedEntry["round"]) => void;
}) {
	const [picked, setPicked] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [locked, setLocked] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function lockIn() {
		if (!picked || busy) return;
		setBusy(true);
		setError(null);

		const res = await fetch(`/api/games/${gameId}/round/guess`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ memberId: picked }),
		});

		if (!res.ok) {
			setBusy(false);
			const body = await res.json().catch(() => null);
			setError(body?.error ?? "Couldn't lock that in — try again.");
			return;
		}

		// Apply the returned view straight to the feed cache. The server also
		// broadcasts, but that only lands if Realtime is configured — relying on
		// it left the picker on screen after a successful guess.
		const view = (await res.json()) as FeedEntry["round"];
		setLocked(true);
		// Hold the confirmation just long enough to read before the panel swaps.
		setTimeout(() => onGuessed(gameId, view), 700);
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

			<motion.div animate={locked ? { scale: [1, 1.06, 1] } : {}}>
				<Button
					type="button"
					variant="brand"
					className="h-12 w-full rounded-full text-base"
					disabled={!picked || busy}
					onClick={lockIn}
				>
					<AnimatePresence mode="wait" initial={false}>
						{locked ? (
							<motion.span
								key="done"
								initial={{ opacity: 0, y: 6 }}
								animate={{ opacity: 1, y: 0 }}
								className="flex items-center gap-1.5"
							>
								<CheckIcon className="size-4" />
								Locked in
							</motion.span>
						) : busy ? (
							<motion.span
								key="busy"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
							>
								Locking in…
							</motion.span>
						) : (
							<motion.span
								key="idle"
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
							>
								Lock it in
							</motion.span>
						)}
					</AnimatePresence>
				</Button>
			</motion.div>
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
	justRevealed,
}: {
	round: Extract<FeedEntry["round"], { state: "revealed" }>;
	justRevealed: boolean;
}) {
	return (
		<motion.div
			// A round that flips while you're watching gets the full treatment;
			// one that was already revealed on load just appears.
			initial={
				justRevealed ? { opacity: 0, scale: 0.94 } : { opacity: 0, y: 8 }
			}
			animate={{ opacity: 1, scale: 1, y: 0 }}
			transition={
				justRevealed
					? { type: "spring", stiffness: 260, damping: 18 }
					: { duration: 0.2 }
			}
			className="relative flex flex-col gap-3 border-2 border-foreground p-4"
		>
			{justRevealed && <RevealBurst />}
			<div className="flex items-center gap-2">
				<span
					className={`grid size-6 place-items-center rounded-full ${
						round.missed
							? "bg-muted text-muted-foreground"
							: round.correct
								? "bg-brand text-brand-foreground"
								: "bg-foreground text-background"
					}`}
				>
					{round.missed ? (
						<ClockIcon className="size-3.5" />
					) : round.correct ? (
						<CheckIcon className="size-3.5" />
					) : (
						<XIcon className="size-3.5" />
					)}
				</span>
				{/* Never showing a verdict to someone who didn't guess — missing the
				    window isn't the same as being wrong. */}
				<p className="text-lg font-display tracking-wide uppercase">
					{round.missed ? "Missed it" : round.correct ? "Got it" : "Nope"}
				</p>
				{round.points > 0 && (
					<span className="ml-auto font-mono text-sm font-bold tabular-nums">
						+{round.points}
					</span>
				)}
			</div>
			<div className="flex items-center gap-2.5">
				<motion.div
					initial={justRevealed ? { scale: 0, rotate: -25 } : false}
					animate={{ scale: 1, rotate: 0 }}
					transition={{
						type: "spring",
						stiffness: 300,
						damping: 16,
						delay: justRevealed ? 0.35 : 0,
					}}
				>
					<Avatar>
						{round.answer.image && (
							<AvatarImage src={round.answer.image} alt={round.answer.name} />
						)}
						<AvatarFallback>
							{round.answer.name.charAt(0).toUpperCase()}
						</AvatarFallback>
					</Avatar>
				</motion.div>
				<p className="text-sm">
					It was <span className="font-bold">{round.answer.name}</span>
					{!round.correct && round.guessed && (
						<span className="text-muted-foreground">
							{" "}
							— you said {round.guessed.name}
						</span>
					)}
					{round.missed && (
						<span className="text-muted-foreground">
							{" "}
							— you didn't guess in time
						</span>
					)}
				</p>
			</div>
			<div className="flex items-center justify-between gap-3">
				<ShareResult
					roundNumber={round.roundNumber}
					correct={round.correct}
					missed={round.missed}
					streak={round.streak}
				/>
				<span className="font-mono text-xs text-muted-foreground">
					streak {round.streak}
				</span>
			</div>
			<InlineSongBank />
		</motion.div>
	);
}

/**
 * Plays once when a round reveals live — the last guess landing, or 17:00
 * passing while you're on the page. A brand wash sweeps the card and settles,
 * so the answer arriving feels like an event rather than a re-render.
 */
function RevealBurst() {
	return (
		<motion.span
			aria-hidden
			initial={{ scaleY: 1 }}
			animate={{ scaleY: 0 }}
			transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
			style={{ originY: 1 }}
			className="pointer-events-none absolute inset-0 z-10 bg-brand motion-reduce:hidden"
		/>
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
				<p className="font-display tracking-wide uppercase">Your song 👀</p>
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

function DonePanel({ remaining, index }: { remaining: number; index: number }) {
	const done = remaining === 0;
	return (
		<Shell index={index}>
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

				<h2 className="text-3xl font-display tracking-wide uppercase leading-[0.95]">
					{done ? "All songs guessed" : `${remaining} still to guess`}
				</h2>
				<p className="max-w-xs font-mono text-sm text-muted-foreground">
					{done ? "Bank a song for tomorrow's pool." : "Finish the rest above."}
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
		<Shell index={0}>
			<div className="flex flex-col items-center gap-3 text-center">
				<h2 className="text-3xl font-display tracking-wide uppercase leading-[0.95]">
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
