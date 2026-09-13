"use client";

import { useEffect, useState } from "react";
import { FeedScroller } from "@/components/round-feed";
import type { FeedEntry, MemberView, RoundView } from "@/lib/round";

/**
 * Dev-only design harness for the play surface (/dev/play).
 *
 * Panel height is behaviour, not just decoration: the member picker is the one
 * block that grows with the room, and the bug this layout fixed only appeared
 * once a room had enough members to overflow. So the control that matters most
 * here is the seat count — drag it 3 → 12 and check that the cassette shrinks
 * to absorb it, the picker switches to three columns, and nothing inside the
 * panel ever starts scrolling.
 *
 * Everything is synthetic and offline: artwork is an inline SVG, the preview
 * track is silence generated in the browser, and guesses resolve locally.
 */

const STATES = ["guessing", "locked", "revealed", "submitter"] as const;
type State = (typeof STATES)[number];

// Deliberately uneven — short names, long names and one that must truncate.
const NAMES = [
	"Al",
	"Priya",
	"Jamie",
	"Sam",
	"Nadia",
	"Tom",
	"Kit",
	"Ashwin",
	"Bartholomew Pemberton",
	"Fia",
	"Noor",
	"Dev",
];

const TRACKS = [
	{ title: "Teenage Dirtbag", artist: "Wheatus", hue: 25 },
	{ title: "This Boy's In Love", artist: "The Presets", hue: 200 },
	{
		title: "Everything Is Embarrassing But This Title Is Long Enough To Clip",
		artist: "Sky Ferreira",
		hue: 320,
	},
	{ title: "Nights", artist: "Frank Ocean", hue: 95 },
];

/** Album art without a network round-trip. */
function artwork(hue: number) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="hsl(${hue} 45% 62%)"/><circle cx="50" cy="50" r="26" fill="hsl(${hue} 55% 38%)"/><circle cx="50" cy="50" r="9" fill="hsl(${hue} 40% 82%)"/></svg>`;
	return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Three seconds of silence as a WAV data URI, so the play button really plays
 * and the reels really spin. Cheaper than shipping an asset for a dev page.
 */
function silence() {
	const rate = 8000;
	const samples = rate * 3;
	const bytes = new Uint8Array(44 + samples);
	const view = new DataView(bytes.buffer);
	const ascii = (at: number, text: string) => {
		for (let i = 0; i < text.length; i++)
			view.setUint8(at + i, text.charCodeAt(i));
	};
	ascii(0, "RIFF");
	view.setUint32(4, 36 + samples, true);
	ascii(8, "WAVEfmt ");
	view.setUint32(16, 16, true); // PCM header size
	view.setUint16(20, 1, true); // PCM
	view.setUint16(22, 1, true); // mono
	view.setUint32(24, rate, true);
	view.setUint32(28, rate, true);
	view.setUint16(32, 1, true); // block align
	view.setUint16(34, 8, true); // bits per sample
	ascii(36, "data");
	view.setUint32(40, samples, true);
	bytes.fill(128, 44); // 8-bit PCM silence is mid-scale, not zero

	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return `data:audio/wav;base64,${btoa(binary)}`;
}

function members(count: number): MemberView[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `m${i}`,
		name: NAMES[i % NAMES.length],
		image: null,
	}));
}

function buildRound(
	state: State,
	roster: MemberView[],
	trackIndex: number,
	preview: string | null,
): RoundView {
	const chosen = TRACKS[trackIndex % TRACKS.length];
	const track = {
		title: chosen.title,
		artist: chosen.artist,
		album: null,
		artworkUrl: artwork(chosen.hue),
		previewUrl: preview,
	};

	// Everyone but the viewer, who is always roster[0] here.
	const others = roster.slice(1);

	switch (state) {
		case "guessing":
			return { state, roundId: "r1", track };
		case "locked":
			return {
				state,
				roundId: "r1",
				track,
				guessed: others[0],
				waitingOn: Math.max(others.length - 2, 0),
				revealAt: new Date(Date.now() + 3_600_000).toISOString(),
				bonus: { status: "unanswered", bonusType: "year" },
			};
		case "revealed":
			return {
				state,
				roundId: "r1",
				track,
				missed: false,
				correct: false,
				points: 0,
				roundNumber: 23,
				streak: 7,
				answer: others[1] ?? others[0],
				guessed: others[0],
				bonus: {
					status: "answered",
					bonusType: "year",
					correct: true,
					close: false,
					points: 50,
					answer: 2005,
				},
			};
		case "submitter":
			return {
				state,
				roundId: "r1",
				track,
				guesses: others.map((m, i) => ({
					name: m.name,
					image: m.image,
					correct: i % 4 === 0,
				})),
				fooled: Math.max(others.length - Math.ceil(others.length / 4), 0),
				waitingOn: 2,
				bonus: { status: "unanswered", bonusType: "year" },
			};
	}
}

export function PlayPreview() {
	const [seats, setSeats] = useState(6);
	const [shown, setShown] = useState<State[]>([...STATES]);
	const [preview] = useState(silence);
	const [open, setOpen] = useState(true);

	// `?bare` collapses the controls, so a screenshot of the panel isn't a
	// screenshot of the control bar sitting on top of it. Read in an effect
	// rather than in the initializer: branching on `window` during render makes
	// the server and client disagree, which is a hydration error.
	useEffect(() => {
		if (new URLSearchParams(window.location.search).has("bare")) setOpen(false);
	}, []);
	// Remounts the feed so a state swap re-runs the reveal animation.
	const [nonce, setNonce] = useState(0);

	const roster = members(seats);
	const entries: FeedEntry[] = shown.map((state, i) => ({
		gameId: `preview-${state}`,
		gameName: `${state} room`,
		viewerMemberId: roster[0].id,
		members: roster,
		round: buildRound(state, roster, i, preview),
	}));

	function toggle(state: State) {
		setShown((current) =>
			current.includes(state)
				? current.filter((s) => s !== state)
				: [...STATES].filter((s) => current.includes(s) || s === state),
		);
	}

	return (
		<>
			<FeedScroller
				key={`${nonce}-${seats}-${shown.join()}`}
				entries={entries}
				onGuessed={() => setNonce((n) => n + 1)}
				// No round to POST against — resolve straight to the locked view so
				// the lock-in flow can still be walked end to end.
				submitGuess={async (_gameId, memberId) => ({
					state: "locked",
					roundId: "r1",
					track:
						entries[0].round.state === "none"
							? {
									title: "",
									artist: "",
									album: null,
									artworkUrl: null,
									previewUrl: null,
								}
							: entries[0].round.track,
					guessed:
						roster.find((m) => m.id === memberId) ?? roster[1] ?? roster[0],
					waitingOn: 2,
					revealAt: new Date(Date.now() + 3_600_000).toISOString(),
					bonus: { status: "unanswered", bonusType: "year" } as const,
				})}
			/>

			{/* `fixed`, so it never becomes a flex item of <body> and never
			    competes with the feed's own scroller. Collapsible because the panel
			    is a full screen by design — parked anywhere, the bar covers
			    something worth looking at. */}
			<div className="fixed top-2 left-2 z-50 flex max-w-[calc(100vw-1rem)] flex-col gap-2 rounded-(--radius-frame) border-2 border-rule-strong bg-card p-2 shadow-(--shadow-lift)">
				<button
					type="button"
					onClick={() => setOpen((o) => !o)}
					className="text-left font-mono text-[10px] font-semibold tracking-widest uppercase text-muted-foreground"
				>
					{open ? "Preview ▲" : "Preview ▼"}
				</button>

				{!open ? null : (
					<>
						<label className="flex items-center gap-2 font-mono text-xs">
							<span className="w-16 shrink-0 tracking-widest uppercase text-muted-foreground">
								Seats
							</span>
							<input
								type="range"
								min={3}
								max={12}
								value={seats}
								onChange={(e) => setSeats(Number(e.target.value))}
								className="h-11 w-32 accent-[var(--brand)]"
							/>
							<span className="w-6 tabular-nums font-bold">{seats}</span>
						</label>

						<div className="flex flex-wrap gap-1">
							{STATES.map((state) => (
								<button
									key={state}
									type="button"
									onClick={() => toggle(state)}
									aria-pressed={shown.includes(state)}
									className={`min-h-9 rounded-full border-2 border-rule-strong px-3 font-mono text-[10px] font-semibold tracking-widest uppercase ${
										shown.includes(state)
											? "bg-brand text-brand-foreground"
											: "text-muted-foreground"
									}`}
								>
									{state}
								</button>
							))}
						</div>
					</>
				)}
			</div>
		</>
	);
}
