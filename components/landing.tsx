"use client";

import { HeartIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { EqMark } from "@/components/eq-mark";
import { Button } from "@/components/ui/button";

const STEPS = [
	{ num: "01", label: "Bank a song", detail: "Something obvious. Or a psyop." },
	{ num: "02", label: "Guess whose it is", detail: "One shot, once a day." },
	{
		num: "03",
		label: "See who you fooled",
		detail: "Every wrong guess pays you.",
	},
];

const PROMISES = [
	{ label: "Your data is never sold", description: "Not now, not ever." },
	{ label: "No ads, ever", description: "I hate them as much as you do." },
	{ label: "100% free, forever", description: "Not running a business here." },
];

const TICKER = [
	"Bank a song",
	"Guess whose it is",
	"See who you fooled",
	"New round at midnight",
];

// Scroll-triggered reveals rather than load fade-ins: nothing is hidden from a
// reader who never scrolls, and the hero is painted at full opacity on arrival.
const reveal = {
	initial: { opacity: 0, y: 16 },
	whileInView: { opacity: 1, y: 0 },
	viewport: { once: true, amount: 0.4 },
};

export function Landing() {
	return (
		<div className="flex flex-1 flex-col">
			<header className="mx-auto flex w-full max-w-4xl items-center justify-between px-4 py-5 sm:px-6">
				<div className="flex items-center gap-2.5">
					<EqMark className="h-9 w-9 px-2 py-1.5" />
					<span className="text-lg font-bold tracking-tighter">SongDraw</span>
				</div>
				<div className="flex items-center gap-2">
					<Button asChild variant="outline" className="rounded-full px-5">
						<Link href="/login">Log in</Link>
					</Button>
					<Button
						asChild
						variant="brand"
						className="hidden rounded-full px-5 sm:inline-flex"
					>
						<Link href="/signup">Sign up</Link>
					</Button>
				</div>
			</header>

			<section className="mx-auto w-full max-w-4xl px-4 pt-14 pb-16 sm:px-6 sm:pt-24 sm:pb-20">
				<h1 className="font-display text-7xl leading-[0.9] tracking-wide uppercase sm:text-9xl">
					{/* Each line lifts in on its own beat — the one entrance on the
					    page, and it plays immediately rather than on scroll. */}
					{["Whose", null, "is this?"].map((line, index) =>
						line === null ? (
							<motion.span
								key="song"
								initial={{ opacity: 0, y: 20, rotate: -6 }}
								animate={{ opacity: 1, y: 0, rotate: -1 }}
								transition={{
									delay: 0.09,
									type: "spring",
									stiffness: 260,
									damping: 18,
								}}
								className="my-1 inline-block bg-brand px-3 text-brand-foreground"
							>
								Song
							</motion.span>
						) : (
							<motion.span
								key={line}
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{
									delay: index * 0.09,
									type: "spring",
									stiffness: 260,
									damping: 22,
								}}
								className="block"
							>
								{line}
							</motion.span>
						),
					)}
				</h1>
				<motion.p
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.3 }}
					className="mt-6 max-w-md font-mono text-sm text-muted-foreground sm:text-base"
				>
					A daily guessing game for your friend group. One song, one guess,
					thirty seconds a day.
				</motion.p>
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ delay: 0.38 }}
					className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
				>
					<Button
						asChild
						variant="brand"
						className="h-12 rounded-full px-8 text-base"
					>
						<Link href="/signup">Start a room</Link>
					</Button>
					<span className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
						Free · No Spotify · 3 friends minimum
					</span>
				</motion.div>
			</section>

			<div
				aria-hidden
				className="overflow-hidden border-y-2 border-foreground py-3"
			>
				<div className="flex w-max animate-[marquee_20s_linear_infinite] motion-reduce:animate-none">
					{[0, 1].map((copy) => (
						<div key={copy} className="flex shrink-0">
							{TICKER.map((phrase) => (
								<span
									key={phrase}
									className="pr-6 font-mono text-sm font-semibold tracking-widest uppercase"
								>
									{phrase} <span className="pl-4">✦</span>
								</span>
							))}
						</div>
					))}
				</div>
			</div>

			<section className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 sm:py-16">
				<motion.div
					{...reveal}
					className="grid divide-y-2 divide-foreground border-2 border-foreground shadow-[6px_6px_0_0_var(--color-foreground)] sm:grid-cols-3 sm:divide-x-2 sm:divide-y-0"
				>
					{STEPS.map((step) => (
						<div
							key={step.num}
							className="flex flex-col gap-3 p-6 transition-colors hover:bg-brand hover:text-brand-foreground"
						>
							<span className="font-mono text-4xl font-black sm:text-5xl">
								{step.num}
							</span>
							<p className="text-lg font-bold">{step.label}</p>
							<p className="font-mono text-sm text-muted-foreground">
								{step.detail}
							</p>
						</div>
					))}
				</motion.div>
			</section>

			<section className="mx-auto w-full max-w-4xl px-4 pb-14 sm:px-6 sm:pb-16">
				<motion.div {...reveal}>
					<h2 className="font-mono text-xs font-semibold tracking-widest text-muted-foreground uppercase">
						My promise
					</h2>
					<p className="mt-2 font-display text-3xl tracking-wide uppercase">
						Just me and a game I made.
					</p>
					<div className="mt-6 grid divide-y-2 divide-foreground border-2 border-foreground sm:grid-cols-3 sm:divide-x-2 sm:divide-y-0">
						{PROMISES.map((promise) => (
							<div key={promise.label} className="flex flex-col gap-1 p-6">
								<p className="font-bold">{promise.label}</p>
								<p className="font-mono text-sm text-muted-foreground">
									{promise.description}
								</p>
							</div>
						))}
					</div>
				</motion.div>
			</section>

			{/* The page previously ran out without asking again — by the time you'd
			    read the promises the only CTA was a full screen behind you. */}
			<section className="border-y-2 border-foreground bg-brand text-brand-foreground">
				<motion.div
					{...reveal}
					className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6"
				>
					<p className="font-display text-4xl leading-[0.95] tracking-wide uppercase sm:text-5xl">
						Tonight's round
						<br />
						drops at midnight.
					</p>
					<Button
						asChild
						className="h-12 shrink-0 rounded-full border-2 border-foreground bg-background px-8 text-base text-foreground hover:bg-foreground hover:text-background"
					>
						<Link href="/signup">Sign up</Link>
					</Button>
				</motion.div>
			</section>

			<footer>
				<div className="mx-auto flex w-full max-w-4xl items-center gap-1.5 px-4 py-6 font-mono text-xs tracking-widest uppercase text-muted-foreground sm:px-6">
					<span>Made by Alasdair Roddick with</span>
					<HeartIcon className="size-3.5 fill-current text-destructive" />
				</div>
			</footer>
		</div>
	);
}
