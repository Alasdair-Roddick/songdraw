"use client";

import { CircleHelpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";

export function GameRulesDialog() {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="rounded-full"
				>
					<CircleHelpIcon /> How it works
				</Button>
			</DialogTrigger>
			<DialogContent className="max-h-[85dvh] overflow-y-auto border-2 border-foreground sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>How SongDraw works</DialogTitle>
					<DialogDescription>
						A daily bluffing game for this room.
					</DialogDescription>
				</DialogHeader>
				<ol className="flex flex-col gap-4 text-sm">
					<li>
						<span className="font-bold">1. Bank songs.</span> Every bank is
						private and shared across all your rooms. You need three members
						before rounds begin.
					</li>
					<li>
						<span className="font-bold">2. A song draws at midnight.</span> Each
						eligible member has equal odds, regardless of how many songs they
						have banked.
					</li>
					<li>
						<span className="font-bold">3. Guess the owner.</span> Get it right
						for +100. Each wrong guess gives the submitter +50.
					</li>
					<li>
						<span className="font-bold">4. Reveal at 5pm.</span> The answer
						opens at 17:00 Adelaide, or as soon as everyone has guessed.
					</li>
					<li>
						<span className="font-bold">5. Keep playing to bank.</span> Clear
						every room waiting on you, then queue another song for a future
						draw.
					</li>
				</ol>
			</DialogContent>
		</Dialog>
	);
}
