import type { LucideIcon } from "lucide-react";
import {
	Disc3,
	EyeOff,
	Heart,
	Music,
	ShieldOff,
	Sparkles,
	Trophy,
	Users,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { auth } from "@/lib/auth";

export default async function Home() {
	const session = await auth.api.getSession({ headers: await headers() });

	if (session) {
		redirect("/home");
	}

	return (
		<div className="flex flex-1 flex-col">
			<section className="flex flex-col items-center justify-center gap-8 px-6 py-24 text-center">
				<div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
					<Disc3 className="size-7" />
				</div>
				<div className="flex flex-col gap-3">
					<h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
						SongDraw
					</h1>
					<p className="text-lg text-muted-foreground">
						Whose song is this? A daily guessing game for your friend group.
					</p>
				</div>
				<div className="flex gap-3">
					<Button asChild size="lg">
						<Link href="/signup">Sign up</Link>
					</Button>
					<Button asChild size="lg" variant="outline">
						<Link href="/login">Log in</Link>
					</Button>
				</div>
			</section>

			<section className="border-t px-6 py-16">
				<div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-3">
					<InfoCard icon={Music} label="Submit a song" />
					<InfoCard icon={Users} label="Guess whose it is" />
					<InfoCard icon={Trophy} label="See who you fooled" />
				</div>
			</section>

			<section className="border-t px-6 py-16">
				<div className="mx-auto flex max-w-3xl flex-col items-center gap-2 pb-8 text-center">
					<h2 className="text-xl font-semibold tracking-tight">My promise</h2>
					<p className="text-sm text-muted-foreground">
						Just me and a game I made.
					</p>
				</div>
				<div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-3">
					<InfoCard
						icon={EyeOff}
						label="Your data is never sold"
						description="Not now, not ever."
					/>
					<InfoCard
						icon={ShieldOff}
						label="No ads, ever"
						description="I hate them as much as you do."
					/>
					<InfoCard
						icon={Sparkles}
						label="100% free, forever"
						description="Not running a business here."
					/>
				</div>
			</section>

			<footer className="flex items-center justify-center gap-1.5 border-t px-6 py-8 text-sm text-muted-foreground">
				<span>Made by Alasdair Roddick with</span>
				<Heart className="size-4 fill-current text-destructive" />
			</footer>
		</div>
	);
}

function InfoCard({
	icon: Icon,
	label,
	description,
}: {
	icon: LucideIcon;
	label: string;
	description?: string;
}) {
	return (
		<Card>
			<CardContent className="flex flex-col items-center gap-2 py-8 text-center">
				<Icon className="size-6 text-muted-foreground" />
				<p className="font-medium">{label}</p>
				{description ? <CardDescription>{description}</CardDescription> : null}
			</CardContent>
		</Card>
	);
}
