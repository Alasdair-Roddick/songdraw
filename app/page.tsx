import { Heart } from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EqMark } from "@/components/eq-mark";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

const STEPS = [
	{ num: "01", label: "Submit a song" },
	{ num: "02", label: "Guess whose it is" },
	{ num: "03", label: "See who you fooled" },
];

const PROMISES = [
	{ label: "Your data is never sold", description: "Not now, not ever." },
	{ label: "No ads, ever", description: "I hate them as much as you do." },
	{ label: "100% free, forever", description: "Not running a business here." },
];

const TICKER = [
	"Submit a song",
	"Guess whose it is",
	"See who you fooled",
	"New round at midnight",
];

export default async function Home() {
	const session = await auth.api.getSession({ headers: await headers() });

	if (session) {
		redirect("/home");
	}

	return (
		<div className="flex flex-1 flex-col">
			<header className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-5">
				<div className="flex items-center gap-2.5">
					<EqMark className="h-9 w-9 px-2 py-1.5" />
					<span className="text-lg font-bold tracking-tighter">SongDraw</span>
				</div>
				<Button asChild variant="outline" className="rounded-full px-5">
					<Link href="/login">Log in</Link>
				</Button>
			</header>

			<section className="mx-auto w-full max-w-4xl px-6 pt-16 pb-20 sm:pt-24">
				<h1 className="text-6xl leading-[0.95] font-black tracking-tighter uppercase sm:text-8xl">
					Whose{" "}
					<span className="inline-block -rotate-1 bg-brand px-3 text-brand-foreground">
						song
					</span>
					<br />
					is this?
				</h1>
				<p className="mt-6 font-mono text-sm text-muted-foreground sm:text-base">
					A daily guessing game for your friend group.
				</p>
				<div className="mt-10">
					<Button
						asChild
						variant="brand"
						className="h-12 rounded-full px-8 text-base"
					>
						<Link href="/signup">Sign up</Link>
					</Button>
				</div>
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

			<section className="mx-auto w-full max-w-4xl px-6 py-16">
				<div className="grid divide-y-2 divide-foreground border-2 border-foreground sm:grid-cols-3 sm:divide-x-2 sm:divide-y-0">
					{STEPS.map((step) => (
						<div
							key={step.num}
							className="flex flex-col gap-4 p-6 transition-colors hover:bg-brand hover:text-brand-foreground"
						>
							<span className="font-mono text-5xl font-black">{step.num}</span>
							<p className="text-lg font-bold">{step.label}</p>
						</div>
					))}
				</div>
			</section>

			<section className="mx-auto w-full max-w-4xl px-6 pb-16">
				<h2 className="font-mono text-xs font-semibold tracking-widest text-muted-foreground uppercase">
					My promise
				</h2>
				<p className="mt-2 text-2xl font-bold tracking-tight">
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
			</section>

			<footer className="border-t-2 border-foreground">
				<div className="mx-auto flex w-full max-w-4xl items-center gap-1.5 px-6 py-6 font-mono text-xs tracking-widest uppercase text-muted-foreground">
					<span>Made by Alasdair Roddick with</span>
					<Heart className="size-3.5 fill-current text-destructive" />
				</div>
			</footer>
		</div>
	);
}
