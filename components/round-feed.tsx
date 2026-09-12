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
import { Cassette } from "@/components/cassette";
import { InlineSongBank } from "@/components/inline-song-bank";
import { ShareResult } from "@/components/share-result";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useFeed } from "@/hooks/use-feed";
import type { FeedEntry, MemberView } from "@/lib/round";

export function RoundFeed({ channels }: { channels: string[] }) {
	const { entries, isLoading, applyRound } = useFeed(channels);

	if (isLoading && entries.length === 0) return null;

	return <FeedScroller entries={entries} onGuessed={applyRound} />;
}

/**
 * The feed without its data source. Split out so the dev-only design preview
 * at /dev/play can drive the real panels with synthetic rounds instead of
 * reimplementing the layout it exists to check.
 */
export function FeedScroller({
	entries,
	onGuessed,
	/** Overridden by the preview, which has no real round to POST against. */
	submitGuess,
}: {
	entries: FeedEntry[];
	onGuessed: (gameId: string, round: FeedEntry["round"]) => void;
	submitGuess?: (
		gameId: string,
		memberId: string,
	) => Promise<FeedEntry["round"]>;
}) {
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

	const containerRef = useRef<HTMLDivElement>(null);
	const [activeIndex, setActiveIndex] = useState(0);

	// Which panel is on screen, for the progress rail. Not a ratio test: an
	// intersection ratio is measured against the *panel*, so a room taller than
	// the viewport can never reach a 0.6 threshold and the rail would freeze on
	// it. Collapsing the root to a centre line instead means whichever panel
	// crosses the middle is current, at any height.
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const observer = new IntersectionObserver(
			(observed) => {
				for (const entry of observed) {
					if (!entry.isIntersecting) continue;
					setActiveIndex(
						Number((entry.target as HTMLElement).dataset.index ?? "0"),
					);
				}
			},
			{ root: container, rootMargin: "-50% 0px -50% 0px", threshold: 0 },
		);
		for (const panel of container.querySelectorAll("[data-index]")) {
			observer.observe(panel);
		}
		return () => observer.disconnect();
	});

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
			{ root: containerRef.current, threshold: 0.4 },
		);
		const container = containerRef.current;
		if (!container) return;
		for (const panel of container.querySelectorAll("[data-panel]")) {
			observer.observe(panel);
		}
		return () => observer.disconnect();
	}, [playingId]);

	const unguessed = entries.filter(
		(entry) => entry.round.state === "guessing",
	).length;

	// Rooms still wanting a guess come first, so the ones you owe are the
	// screens you hit before any you've already played. Ties keep the server's
	// order so panels don't reshuffle under a thumb mid-scroll.
	//
	// Rooms with no round today render no panel at all, so they're filtered out
	// here rather than inside Panel. One array drives the sections, the rail and
	// the final panel's index — deriving them separately let the rail's dots
	// fall out of step with the panels the moment any room wasn't `guessing`.
	const panels = [...entries]
		.filter((entry) => entry.round.state !== "none")
		.sort((a, b) => {
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

			{/*
			 * One room per screen, hard-locked. `mandatory` + `snap-always` is
			 * what makes a small flick advance exactly one room instead of
			 * drifting; `snap-always` also stops a fast flick skipping past two.
			 *
			 * Every panel is exactly as tall as this scroller and nothing inside
			 * one scrolls, so this is the only scroller on the screen and a
			 * vertical drag has exactly one meaning. The old layout let a room
			 * grow past the viewport and leaned on the oversized-snap-area rule
			 * to stay readable, which is what made a slightly-too-long drag
			 * inside a tall room flick to the next one — see Shell.
			 *
			 * `svh`, not `dvh`: `dvh` tracks the iOS toolbar and so changes the
			 * snap area's height mid-gesture.
			 */}
			<div
				ref={containerRef}
				className="h-[100svh] snap-y snap-mandatory overflow-y-scroll overscroll-y-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				{panels.length === 0 ? (
					<EmptyPanel />
				) : (
					<>
						{panels.map((entry, index) => (
							<Panel
								key={entry.gameId}
								entry={entry}
								index={index}
								justRevealed={justRevealed.has(entry.gameId)}
								onGuessed={onGuessed}
								submitGuess={submitGuess}
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
						<DonePanel remaining={unguessed} index={panels.length} />
					</>
				)}
			</div>

			{panels.length > 0 && (
				<ProgressRail
					entries={panels}
					activeIndex={activeIndex}
					remaining={unguessed}
				/>
			)}
		</>
	);
}

/**
 * Fixed rail showing one mark per room plus the final panel, so you can see how
 * many rounds are left without scrolling. A hollow mark still wants a guess; a
 * filled one is done. Purely indicative — it doesn't scroll the feed, since on
 * mobile the marks are far too small to be reliable tap targets.
 */
function ProgressRail({
	entries,
	activeIndex,
	remaining,
}: {
	entries: FeedEntry[];
	activeIndex: number;
	remaining: number;
}) {
	return (
		// Tucked to the very edge: the panel reserves a gutter for it (see
		// Shell), and any further in and the marks sit over the cassette.
		<div className="pointer-events-none fixed top-1/2 right-1 z-10 flex -translate-y-1/2 flex-col items-center gap-2">
			{remaining > 0 && (
				<span className="mb-1 font-mono text-[10px] font-bold tracking-widest tabular-nums text-muted-foreground [writing-mode:vertical-rl]">
					{remaining} left
				</span>
			)}
			{entries.map((entry, index) => {
				const needsGuess = entry.round.state === "guessing";
				const isActive = index === activeIndex;
				return (
					<motion.span
						key={entry.gameId}
						animate={{ scale: isActive ? 1.35 : 1 }}
						transition={{ type: "spring", stiffness: 400, damping: 24 }}
						className={`size-2 rounded-full border-2 border-rule ${
							needsGuess
								? "bg-background"
								: isActive
									? "bg-brand"
									: "bg-foreground"
						}`}
					/>
				);
			})}
			<span
				className={`h-3 w-0.5 ${
					activeIndex === entries.length ? "bg-brand" : "bg-muted-foreground/40"
				}`}
			/>
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
		// A fixed `h`, and nothing inside it scrolls. That is the whole design:
		// one room is exactly one screen, so a vertical drag can only ever mean
		// "next room". An inner scroll region was tried and is worse than the
		// bug it fixed — a scroller sitting in the middle of a snap feed eats
		// the drag you meant for the feed, and `overscroll-contain` then
		// guarantees you're stuck in it. The content fits instead: the hero
		// absorbs all the slack (Panel) and every other zone is `shrink-0`.
		<section
			data-panel={id}
			data-index={index}
			// `px-6` rather than `px-4` reserves the right-hand gutter the progress
			// rail sits in. The rail is fixed and the column is centred, so
			// padding is what keeps a member chip from running underneath it.
			className="relative flex h-[100svh] snap-start snap-always flex-col px-6 py-5 sm:px-8"
		>
			<div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-3">
				{children}
			</div>
		</section>
	);
}

/**
 * Room name plus what this screen is asking of you, on one line. Both used to
 * be separate blocks; at ~700px of real viewport a panel can't afford the
 * duplication, and the prompt was competing with the hero anyway.
 */
function Eyebrow({ gameId, gameName }: { gameId: string; gameName: string }) {
	return (
		<p className="shrink-0 truncate text-center font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
			<Link href={`/game/${gameId}`} className="hover:text-foreground">
				{gameName}
			</Link>
		</p>
	);
}

function Panel({
	entry,
	index,
	justRevealed,
	onGuessed,
	submitGuess,
	playing,
	onTogglePreview,
}: {
	entry: FeedEntry;
	index: number;
	justRevealed: boolean;
	onGuessed: (gameId: string, round: FeedEntry["round"]) => void;
	submitGuess?: (
		gameId: string,
		memberId: string,
	) => Promise<FeedEntry["round"]>;
	playing: boolean;
	onTogglePreview: () => void;
}) {
	const round = entry.round;
	if (round.state === "none") return null;

	return (
		<Shell id={entry.gameId} index={index}>
			<Eyebrow gameId={entry.gameId} gameName={entry.gameName} />

			{/* The hero is the only elastic zone: it takes whatever height the
			    state body leaves and shrinks on a short viewport, which is how
			    the panel fits without anything scrolling. Title and artist ride
			    on the cassette's card, so there is no caption block or gap here
			    either — that was most of what used to overflow. */}
			<div className="flex min-h-0 flex-1 items-center justify-center">
				<Cassette
					artworkUrl={round.track.artworkUrl}
					artist={round.track.artist}
					playing={playing}
					onToggle={onTogglePreview}
					canPlay={!!round.track.previewUrl}
					label={round.track.title}
				/>
			</div>

			{round.state === "guessing" && (
				<GuessBody
					gameId={entry.gameId}
					members={entry.members}
					viewerMemberId={entry.viewerMemberId}
					onGuessed={onGuessed}
					submitGuess={submitGuess}
				/>
			)}
			{round.state === "locked" && <LockedBody round={round} />}
			{round.state === "revealed" && (
				<RevealedBody round={round} justRevealed={justRevealed} />
			)}
			{round.state === "submitter" && <SubmitterBody round={round} />}
		</Shell>
	);
}

/**
 * The real guess. Returns the server's post-guess view, which is applied
 * straight to the feed cache — the server also broadcasts, but that only lands
 * if Realtime is configured, and relying on it left the picker on screen after
 * a successful guess.
 */
async function postGuess(gameId: string, memberId: string) {
	const res = await fetch(`/api/games/${gameId}/round/guess`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ memberId }),
	});

	if (!res.ok) {
		const body = await res.json().catch(() => null);
		throw new Error(body?.error ?? "Couldn't lock that in — try again.");
	}

	return (await res.json()) as FeedEntry["round"];
}

function GuessBody({
	gameId,
	members,
	viewerMemberId,
	onGuessed,
	submitGuess,
}: {
	gameId: string;
	members: MemberView[];
	viewerMemberId: string;
	onGuessed: (gameId: string, round: FeedEntry["round"]) => void;
	submitGuess?: (
		gameId: string,
		memberId: string,
	) => Promise<FeedEntry["round"]>;
}) {
	const [picked, setPicked] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [locked, setLocked] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function lockIn() {
		if (!picked || busy) return;
		setBusy(true);
		setError(null);

		let view: FeedEntry["round"];
		try {
			view = submitGuess
				? await submitGuess(gameId, picked)
				: await postGuess(gameId, picked);
		} catch (cause) {
			setBusy(false);
			setError(
				cause instanceof Error ? cause.message : "Couldn't lock that in.",
			);
			return;
		}

		setLocked(true);
		// Hold the confirmation just long enough to read before the panel swaps.
		setTimeout(() => onGuessed(gameId, view), 700);
	}

	const others = members.filter((member) => member.id !== viewerMemberId);
	// Three columns past seven, so the picker's height stays capped at four
	// rows however big the room gets. Four rows of 44px is what the panel can
	// afford on a 560px viewport once the hero has shrunk to its floor.
	const columns = others.length > 7 ? "grid-cols-3" : "grid-cols-2";

	return (
		<div className="flex shrink-0 flex-col gap-2">
			<p className="text-center font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
				Whose song is this?
			</p>
			<ul className={`grid gap-1.5 ${columns}`}>
				{others.map((member) => {
					const isPicked = picked === member.id;
					return (
						<li key={member.id}>
							<motion.button
								type="button"
								whileTap={{ scale: 0.97 }}
								onClick={() => setPicked(member.id)}
								aria-pressed={isPicked}
								className={`flex h-11 w-full items-center gap-1.5 border-2 border-rule px-1.5 text-left transition-colors ${
									isPicked ? "bg-brand text-brand-foreground" : "hover:bg-muted"
								}`}
							>
								<Avatar className="size-6 shrink-0">
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
		<div className="shrink-0">
			<div className="flex flex-col items-center gap-2 border-2 border-rule p-4">
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
		<div className="flex shrink-0 flex-col gap-3">
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
				className="relative flex flex-col gap-3 border-2 border-rule p-4"
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
					<p className="text-lg font-display font-extrabold tracking-tight">
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
			</motion.div>

			{/* Banking is the action this screen hands you next, so it sits below
			    the verdict card as its own block rather than inside it. */}
			<InlineSongBank />
		</div>
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
		<div className="flex shrink-0 flex-col gap-3 border-2 border-rule p-3">
			<div className="flex items-center justify-between gap-3">
				<p className="font-display font-extrabold tracking-tight">
					Your song 👀
				</p>
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
				// Faces, not rows. One row per guesser grew without limit and was
				// what pushed this panel past the viewport in a big room; a
				// wrapping grid of avatars holds a dozen people in two rows, and
				// reads faster besides — you're scanning for who you got.
				<ul className="flex flex-wrap gap-2">
					<AnimatePresence initial={false}>
						{round.guesses.map((row) => (
							<motion.li
								key={row.name}
								initial={{ opacity: 0, scale: 0.8 }}
								animate={{ opacity: 1, scale: 1 }}
								transition={{ type: "spring", stiffness: 400, damping: 22 }}
								className="relative"
								title={`${row.name} — ${row.correct ? "got it" : "fooled"}`}
							>
								<Avatar className="size-9 border-2 border-rule">
									{row.image && <AvatarImage src={row.image} alt={row.name} />}
									<AvatarFallback>
										{row.name.charAt(0).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<span
									className={`absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full border-2 border-rule ${
										row.correct
											? "bg-foreground text-background"
											: "bg-brand text-brand-foreground"
									}`}
								>
									{row.correct ? (
										<CheckIcon className="size-2.5" />
									) : (
										<XIcon className="size-2.5" />
									)}
								</span>
								<span className="sr-only">
									{row.name} {row.correct ? "got it" : "was fooled"}
								</span>
							</motion.li>
						))}
					</AnimatePresence>
				</ul>
			)}

			<p className="font-mono text-xs text-muted-foreground">
				<XIcon className="mb-0.5 inline size-3 text-brand" /> fooled ·{" "}
				<CheckIcon className="mb-0.5 inline size-3" /> got it
				{round.waitingOn > 0 && ` · ${round.waitingOn} still to guess`}
			</p>
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
				// `m-auto` centres it in the panel column, which no longer centres
				// its children itself — a play panel fills its height instead.
				className="m-auto flex flex-col items-center gap-4 text-center"
			>
				<motion.span
					animate={done ? { rotate: [0, -8, 8, 0] } : {}}
					transition={{
						duration: 1.2,
						repeat: Number.POSITIVE_INFINITY,
						repeatDelay: 1.5,
					}}
					className="grid size-16 place-items-center rounded-full border-2 border-rule bg-brand text-brand-foreground motion-reduce:animate-none"
				>
					<SparklesIcon className="size-7" />
				</motion.span>

				<h2 className="text-3xl font-display font-extrabold tracking-tight leading-[0.95]">
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
			<div className="m-auto flex flex-col items-center gap-3 text-center">
				<h2 className="text-3xl font-display font-extrabold tracking-tight leading-[0.95]">
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
