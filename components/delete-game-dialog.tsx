"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
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

export function DeleteGameDialog({
	gameId,
	gameName,
}: {
	gameId: string;
	gameName: string;
}) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [confirmation, setConfirmation] = useState("");
	const [deleting, setDeleting] = useState(false);

	// Typing the name back is the whole safety mechanism — the server checks it
	// too, so this isn't just a client-side speed bump.
	const matches = confirmation.trim() === gameName;

	async function handleDelete() {
		setDeleting(true);
		const res = await fetch(`/api/games/${gameId}`, {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name: confirmation.trim() }),
		});
		setDeleting(false);

		if (!res.ok) {
			const body = await res.json().catch(() => null);
			toast.error(body?.error ?? "Couldn't delete the game — try again.");
			return;
		}

		toast.success(`Deleted ${gameName}`);
		router.push("/home");
	}

	return (
		<div className="flex flex-wrap items-center justify-between gap-3 border-2 border-destructive p-4">
			<div className="flex flex-col gap-0.5">
				<p className="font-bold tracking-tight">Delete this game</p>
				<p className="font-mono text-sm text-muted-foreground">
					Members, invites, and every pooled song go with it.
				</p>
			</div>
			<Dialog
				open={open}
				onOpenChange={(next) => {
					setOpen(next);
					if (!next) setConfirmation("");
				}}
			>
				<DialogTrigger asChild>
					<Button type="button" variant="destructive" className="rounded-full">
						Delete
					</Button>
				</DialogTrigger>
				<DialogContent className="rounded-none border-2 border-foreground">
					<DialogHeader>
						<DialogTitle>Delete {gameName}?</DialogTitle>
						<DialogDescription>
							This can't be undone. Every member loses the game and its history.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-2">
						<Label htmlFor="confirm-name">
							Type <span className="font-bold">{gameName}</span> to confirm
						</Label>
						<Input
							id="confirm-name"
							value={confirmation}
							onChange={(e) => setConfirmation(e.target.value)}
							autoComplete="off"
						/>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="destructive"
							className="rounded-full"
							disabled={!matches || deleting}
							onClick={handleDelete}
						>
							{deleting ? "Deleting…" : "Delete game"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
