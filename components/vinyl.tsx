"use client";

import { MusicIcon, PauseIcon, PlayIcon } from "lucide-react";

/**
 * A record with the album art as its label. It spins only while audio is
 * playing — never on load, since nothing here autoplays.
 *
 * The grooves are concentric rings rather than an image, so the whole thing
 * stays sharp at any size and costs no extra request.
 */
export function Vinyl({
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
	return (
		<div className="relative aspect-square w-full max-w-[min(78vw,20rem)]">
			<div
				className={`size-full rounded-full border-2 border-rule bg-primary ${
					playing ? "animate-[spin_4s_linear_infinite]" : ""
				} motion-reduce:animate-none`}
				style={{
					// Grooves. Layered rings read as vinyl without a texture asset.
					backgroundImage:
						"repeating-radial-gradient(circle at center, rgba(255,255,255,0.10) 0 1px, transparent 1px 6px)",
				}}
			>
				<div className="absolute inset-[22%] overflow-hidden rounded-full border-2 border-rule bg-muted">
					{artworkUrl ? (
						// biome-ignore lint/performance/noImgElement: remote iTunes artwork, no next/image benefit
						<img
							src={artworkUrl}
							alt=""
							className="size-full object-cover"
							draggable={false}
						/>
					) : (
						<div className="grid size-full place-items-center">
							<MusicIcon className="size-8 text-muted-foreground" />
						</div>
					)}
					{/* Spindle hole */}
					<div className="absolute top-1/2 left-1/2 size-[9%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-rule bg-background" />
				</div>
			</div>

			{canPlay ? (
				<button
					type="button"
					onClick={onToggle}
					aria-label={playing ? `Pause ${label}` : `Play ${label}`}
					className="absolute -right-1 -bottom-1 grid size-14 place-items-center rounded-full border-2 border-rule bg-brand text-brand-foreground shadow-(--shadow-lift-sm) transition-transform active:translate-y-px"
				>
					{playing ? (
						<PauseIcon className="size-6" />
					) : (
						<PlayIcon className="size-6" />
					)}
				</button>
			) : (
				<span className="absolute right-0 -bottom-1 border-2 border-rule bg-background px-2 py-1 font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
					No preview
				</span>
			)}
		</div>
	);
}
