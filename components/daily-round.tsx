"use client";

import { CheckIcon, MusicIcon, PauseIcon, PlayIcon, XIcon } from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import useSWR from "swr";
import type { Member } from "@/components/member-list";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

type TrackView = {
	title: string;
	artist: string;
	album: string | null;
	artworkUrl: string | null;
	previewUrl: string | null;
};

type RoundView =
	| { state: "none" }
	| {
			state: "submitter";
			roundId: string;
			track: TrackView;
			guesses: { name: string; image: string | null; correct: boolean }[];
			fooled: number;
	  }
	| { state: "guessing"; roundId: string; track: TrackView }
	| {
			state: "revealed";
			roundId: string;
			track: TrackView;
			correct: boolean;
			points: number;
			answer: { memberId: string; name: string; image: string | null };
			guessed: { memberId: string; name: string } | null;
	  };

const fetcher = (url: string) =>
	fetch(url).then((res) => {
		if (!res.ok) throw new Error("failed to load round");
		return res.json();
	});

export function DailyRound({
	gameId,
	members,
	viewerId,
}: {
	gameId: string;
	members: Member[];
	viewerId: string;
}) {
	const router = useRouter();
	const { data, mutate } = useSWR<RoundView>(
		`/api/games/${gameId}/round`,
		fetcher,
		{ refreshInterval: 60_000, revalidateOnFocus: true },
	);

	const [picked, setPicked] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (!data || data.state === "none") return null;

	async function lockIn() {
		if (!picked) return;
		setSubmitting(true);
		setError(null);

		const res = await fetch(`/api/games/${gameId}/round/guess`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ memberId: picked }),
		});
		setSubmitting(false);

		if (!res.ok) {
			const body = await res.json().catch(() => null);
			setError(body?.error ?? "Couldn't lock that in — try again.");
			return;
		}

		// The response *is* the reveal, so there's no flash of stale state.
		await mutate(await res.json(), { revalidate: false });
		router.refresh();
	}

	return (
		<section className="flex flex-col gap-3">
			<h2 className="font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
				Today's song
			</h2>

			<div className="border-2 border-foreground">
				<TrackHeader track={data.track} />

				{data.state === "guessing" && (
					<div className="flex flex-col gap-3 border-t-2 border-foreground p-4">
						<p className="font-bold tracking-tight">Whose song is this?</p>
						<ul className="grid grid-cols-2 gap-2">
							{members
								// You're not the submitter if you're guessing, so you're
								// never a valid answer.
								.filter((member) => member.user.id !== viewerId)
								.map((member) => {
									const isPicked = picked === member.id;
									return (
										<li key={member.id}>
											<motion.button
												type="button"
												whileTap={{ scale: 0.97 }}
												animate={isPicked ? { scale: [1, 1.04, 1] } : {}}
												transition={{
													type: "spring",
													stiffness: 400,
													damping: 22,
												}}
												onClick={() => setPicked(member.id)}
												aria-pressed={isPicked}
												className={`flex w-full items-center gap-2.5 border-2 border-foreground p-2.5 text-left transition-colors ${
													isPicked
														? "bg-brand text-brand-foreground"
														: "hover:bg-muted"
												}`}
											>
												<Avatar>
													{member.user.image && (
														<AvatarImage
															src={member.user.image}
															alt={member.user.name}
														/>
													)}
													<AvatarFallback>
														{member.user.name.charAt(0).toUpperCase()}
													</AvatarFallback>
												</Avatar>
												<span className="min-w-0 truncate font-medium">
													{member.user.name}
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
								className="text-sm text-destructive"
							>
								{error}
							</motion.p>
						)}

						<Button
							type="button"
							variant="brand"
							className="h-12 rounded-full text-base"
							disabled={!picked || submitting}
							onClick={lockIn}
						>
							{submitting ? "Locking in…" : "Lock it in"}
						</Button>
						<p className="text-center font-mono text-xs text-muted-foreground">
							One guess. No takebacks.
						</p>
					</div>
				)}

				{data.state === "revealed" && (
					<motion.div
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						className="flex flex-col gap-3 border-t-2 border-foreground p-4"
					>
						<div className="flex items-center gap-2">
							<span
								className={`grid size-6 place-items-center rounded-full ${
									data.correct
										? "bg-brand text-brand-foreground"
										: "bg-foreground text-background"
								}`}
							>
								{data.correct ? (
									<CheckIcon className="size-3.5" />
								) : (
									<XIcon className="size-3.5" />
								)}
							</span>
							<p className="text-lg font-black tracking-tight uppercase">
								{data.correct ? "Got it" : "Nope"}
							</p>
							{data.points > 0 && (
								<span className="ml-auto font-mono text-sm font-bold tabular-nums">
									+{data.points}
								</span>
							)}
						</div>

						<div className="flex items-center gap-2.5 border-2 border-foreground p-2.5">
							<Avatar>
								{data.answer.image && (
									<AvatarImage src={data.answer.image} alt={data.answer.name} />
								)}
								<AvatarFallback>
									{data.answer.name.charAt(0).toUpperCase()}
								</AvatarFallback>
							</Avatar>
							<p className="text-sm">
								It was <span className="font-bold">{data.answer.name}</span>
								{!data.correct && data.guessed && (
									<span className="text-muted-foreground">
										{" "}
										— you said {data.guessed.name}
									</span>
								)}
							</p>
						</div>
					</motion.div>
				)}

				{data.state === "submitter" && (
					<div className="flex flex-col gap-3 border-t-2 border-foreground p-4">
						<div className="flex items-center justify-between gap-3">
							<p className="font-black tracking-tight uppercase">
								Your song is up 👀
							</p>
							<span className="font-mono text-sm font-bold tabular-nums">
								{data.fooled} fooled
							</span>
						</div>

						{data.guesses.length === 0 ? (
							<p className="font-mono text-sm text-muted-foreground">
								Nobody's guessed yet.
							</p>
						) : (
							<ul className="divide-y-2 divide-foreground border-2 border-foreground">
								{data.guesses.map((row) => (
									<li
										key={row.name}
										className="flex items-center justify-between gap-3 p-2.5"
									>
										<div className="flex min-w-0 items-center gap-2.5">
											<Avatar>
												{row.image && (
													<AvatarImage src={row.image} alt={row.name} />
												)}
												<AvatarFallback>
													{row.name.charAt(0).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<span className="truncate font-medium">{row.name}</span>
										</div>
										{/* Who guessed right is safe to show here — it's the
										    submitter's own view, and they already know the answer. */}
										<span className="shrink-0 font-mono text-xs tracking-widest uppercase text-muted-foreground">
											{row.correct ? "got it" : "fooled"}
										</span>
									</li>
								))}
							</ul>
						)}
					</div>
				)}
			</div>
		</section>
	);
}

function TrackHeader({ track }: { track: TrackView }) {
	const [playing, setPlaying] = useState(false);
	const audioRef = useRef<HTMLAudioElement>(null);

	function toggle() {
		const audio = audioRef.current;
		if (!audio || !track.previewUrl) return;
		if (playing) {
			audio.pause();
			setPlaying(false);
			return;
		}
		audio.src = track.previewUrl;
		audio.play();
		setPlaying(true);
	}

	return (
		<div className="flex items-center gap-4 p-4">
			<div className="relative size-20 shrink-0 border-2 border-foreground bg-muted">
				{track.artworkUrl ? (
					// biome-ignore lint/performance/noImgElement: remote iTunes artwork, no next/image benefit
					<img
						src={track.artworkUrl}
						alt=""
						className="size-full object-cover"
					/>
				) : (
					<div className="grid size-full place-items-center">
						<MusicIcon className="size-6 text-muted-foreground" />
					</div>
				)}
				{track.previewUrl && (
					<button
						type="button"
						onClick={toggle}
						aria-label={playing ? "Pause preview" : "Play preview"}
						className="absolute inset-0 grid place-items-center bg-foreground/30 transition-colors hover:bg-foreground/50"
					>
						<span className="grid size-9 place-items-center rounded-full border-2 border-foreground bg-brand text-brand-foreground">
							{playing ? (
								<PauseIcon className="size-4" />
							) : (
								<PlayIcon className="size-4" />
							)}
						</span>
					</button>
				)}
			</div>

			<div className="flex min-w-0 flex-col gap-0.5">
				<p className="truncate text-lg font-black tracking-tight">
					{track.title}
				</p>
				<p className="truncate font-mono text-sm text-muted-foreground">
					{track.artist}
				</p>
				{!track.previewUrl && (
					<p className="font-mono text-xs text-muted-foreground">No preview</p>
				)}
			</div>

			{/** biome-ignore lint/a11y/useMediaCaption: 30s music preview, not spoken content */}
			<audio
				ref={audioRef}
				onEnded={() => setPlaying(false)}
				className="hidden"
			/>
		</div>
	);
}
