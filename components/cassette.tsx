"use client";

import { MusicIcon, PauseIcon, PlayIcon } from "lucide-react";

/**
 * The drawn track as a compact cassette, with the album cover as its J-card.
 *
 * It replaced a spinning record for one reason: the play panel is height-
 * constrained, and a square hero isn't affordable there. At 8:5 — the real
 * cassette ratio — the hero costs ~210px instead of ~304px, and carrying the
 * title and artist on the card absorbs the caption block that used to sit
 * underneath it and its gap. The cover itself stays square and uncropped, and
 * as tall as the card, so it's still the thing you look at first.
 *
 * Sized from the height its panel has left over (`h-full` inside the panel's
 * one `flex-1` zone), with `max-h` folding in the width constraint so the
 * derived width can never exceed the column and distort the ratio. That makes
 * the cassette the panel's shock absorber: a short viewport or a big room
 * shrinks the artwork instead of pushing the picker off the bottom, which is
 * what lets a panel fit without anything inside it scrolling. See the panel
 * invariants in docs/style-guide.md.
 *
 * It reads as an object rather than an outline because of a tonal stack, not
 * extra borders: dark shell, light card, recessed window, dark spools. That's
 * the style guide's "depth comes from light, tone over line" applied to a
 * physical thing. Everything is drawn with tokens and gradients — no texture
 * asset, no extra request, sharp at any size.
 */
export function Cassette({
	artworkUrl,
	artist,
	playing,
	onToggle,
	canPlay,
	label,
}: {
	artworkUrl: string | null;
	artist: string;
	playing: boolean;
	onToggle: () => void;
	canPlay: boolean;
	label: string;
}) {
	return (
		// Height-driven (`h-full` off the panel's one elastic zone) with the
		// width constraint folded into `max-h`, so the derived width can never
		// exceed the column and distort the ratio. The inner `min()` is the
		// column's own width — viewport minus Shell's `px-6`, capped at its
		// `max-w-md` — so this tracks the panel rather than the raw viewport.
		<div className="relative mx-auto aspect-[8/5] h-full w-auto max-h-[calc(min(100vw-3rem,28rem)/1.6)]">
			{/* The shell. Warm near-black against warm paper — the one move that
			    stops the whole thing reading as a wireframe. */}
			<div className="flex size-full flex-col gap-[2%] rounded-(--radius-frame) bg-primary p-[3%] shadow-(--shadow-lift)">
				{/* J-card: the cover, square and full height, with the track beside
				    it. */}
				<div className="flex min-h-0 flex-1 items-stretch gap-2 rounded-(--radius-frame) bg-background p-[2%]">
					{/* The cover is the play control. A pill floating off the corner
					    of the shell read as a stray widget rather than part of the
					    object, and the cover is both the largest thing on the panel
					    and the most obvious thing to tap to hear a song. */}
					<Cover
						artworkUrl={artworkUrl}
						playing={playing}
						onToggle={onToggle}
						canPlay={canPlay}
						label={label}
					/>

					{/* Title and artist stay on the sans — display type is for our
					    words, not the artist's. */}
					<div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 pr-0.5">
						<p className="line-clamp-3 text-sm font-bold leading-tight tracking-tight">
							{label}
						</p>
						<p className="truncate text-xs text-muted-foreground">{artist}</p>
					</div>

					<span className="shrink-0 self-start border-2 border-rule px-1 font-mono text-[9px] font-semibold tracking-widest text-muted-foreground">
						A
					</span>
				</div>

				{/* The window, recessed a tone below the card, tape spooling between
				    two hubs across the full width of the shell. */}
				<div className="flex h-[24%] shrink-0 items-center gap-[3%] rounded-(--radius-frame) border-2 border-rule bg-muted px-[6%]">
					<Spool playing={playing} wound={0.78} />
					<span aria-hidden className="h-0.5 flex-1 bg-primary" />
					<Spool playing={playing} wound={0.36} />
				</div>

				{/* Shell base: two screws and the head opening. Deliberately small —
				    at this size more detail turns to noise. */}
				<div className="flex h-[9%] shrink-0 items-center justify-between px-[2%]">
					<Screw />
					<span
						aria-hidden
						className="h-2/3 w-[30%] rounded-(--radius-frame) bg-background/15"
					/>
					<Screw />
				</div>
			</div>
		</div>
	);
}

/**
 * The album cover, doubling as the transport control. The whole square is the
 * tap target — far past the 44px minimum at any panel size — with a badge in
 * the corner so the affordance is visible rather than merely discoverable.
 */
function Cover({
	artworkUrl,
	playing,
	onToggle,
	canPlay,
	label,
}: {
	artworkUrl: string | null;
	playing: boolean;
	onToggle: () => void;
	canPlay: boolean;
	label: string;
}) {
	const art = artworkUrl ? (
		// biome-ignore lint/performance/noImgElement: remote iTunes artwork, no next/image benefit
		<img
			src={artworkUrl}
			alt=""
			className="size-full object-cover"
			draggable={false}
		/>
	) : (
		<div className="grid size-full place-items-center bg-muted">
			<MusicIcon className="size-6 text-muted-foreground" />
		</div>
	);

	if (!canPlay) {
		return (
			<div className="relative aspect-square h-full shrink-0 overflow-hidden border-2 border-rule bg-muted">
				{art}
				<span className="absolute inset-x-0 bottom-0 bg-background/90 py-0.5 text-center font-mono text-[9px] tracking-widest uppercase text-muted-foreground">
					No preview
				</span>
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={onToggle}
			aria-label={playing ? `Pause ${label}` : `Play ${label}`}
			className="group relative aspect-square h-full shrink-0 overflow-hidden border-2 border-rule bg-muted transition-transform active:scale-[0.98]"
		>
			{art}
			<span className="absolute right-1 bottom-1 grid size-8 place-items-center rounded-full border-2 border-rule bg-brand text-brand-foreground shadow-(--shadow-lift-sm)">
				{playing ? (
					<PauseIcon className="size-4" />
				) : (
					<PlayIcon className="size-4" />
				)}
			</span>
		</button>
	);
}

/**
 * One spool: tape wound around a toothed hub. `wound` is how full it is, so
 * the two sit at different radii and the cassette reads as part-played rather
 * than symmetrical. The hub turns only while audio plays — nothing here
 * autoplays, so a still cassette is the resting state.
 *
 * A CSS animation, so it needs `motion-reduce` explicitly: MotionConfig only
 * governs `motion/react`.
 */
function Spool({ playing, wound }: { playing: boolean; wound: number }) {
	return (
		<span className="relative grid aspect-square h-[82%] shrink-0 place-items-center">
			{/* The wound tape. */}
			<span
				aria-hidden
				className="absolute rounded-full bg-primary"
				style={{ inset: `${(1 - wound) * 26}%` }}
			/>
			<span
				aria-hidden
				className={`relative size-[36%] rounded-full border-2 border-rule bg-background ${
					playing ? "animate-[spin_2s_linear_infinite]" : ""
				} motion-reduce:animate-none`}
				style={{
					// Six-tooth hub.
					backgroundImage:
						"repeating-conic-gradient(from 0deg, var(--primary) 0deg 14deg, transparent 14deg 60deg)",
				}}
			/>
		</span>
	);
}

function Screw() {
	return (
		<span
			aria-hidden
			className="aspect-square h-2/3 rounded-full bg-background/20"
		/>
	);
}
