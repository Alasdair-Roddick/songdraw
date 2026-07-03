"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CreateGameDialog() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleCreate() {
		setError(null);
		setLoading(true);

		const res = await fetch("/api/games", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name }),
		});

		setLoading(false);
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			setError(body?.error ?? "Couldn't create game — try again.");
			return;
		}

		setName("");
		setOpen(false);
		router.refresh();
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button type="button">
					<PlusIcon />
					New game
				</Button>
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create a game</DialogTitle>
					<DialogDescription>
						You're the owner. Nobody can submit a song until 3 people have
						joined.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-2">
					<Label htmlFor="game-name">Game name</Label>
					<Input
						id="game-name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Friend group"
					/>
					{error && <p className="text-sm text-destructive">{error}</p>}
				</div>
				<DialogFooter>
					<Button
						type="button"
						disabled={loading || !name.trim()}
						onClick={handleCreate}
					>
						{loading ? "Creating…" : "Create"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
