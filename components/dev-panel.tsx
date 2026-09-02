"use client";

import { FastForwardIcon, RotateCcwIcon, ZapIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Action = "draw" | "advance" | "reset";

// Only rendered when DEV_MODE=true outside production — see the matching
// server-side guard in app/game/[id]/page.tsx and the route itself.
export function DevPanel({ gameId }: { gameId: string }) {
	const router = useRouter();
	const [busy, setBusy] = useState<Action | null>(null);

	async function run(action: Action) {
		setBusy(action);
		const res = await fetch("/api/dev/round", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ gameId, action }),
		});
		setBusy(null);

		const body = await res.json().catch(() => null);
		if (!res.ok) {
			toast.error(body?.error ?? "Dev action failed.");
			return;
		}

		// The draw is a no-op when a round already exists, and silently doing
		// nothing is exactly the confusing case here — so say which happened.
		const detail =
			body?.status === "dry"
				? "Pool is dry — bank a song first."
				: body?.status === "exists"
					? "Round already drawn for today."
					: body?.status === "reset"
						? "Rounds and stats cleared."
						: action === "advance"
							? "Day advanced — new round drawn."
							: "Round drawn.";
		toast.success(detail);
		router.refresh();
	}

	return (
		<section className="flex flex-col gap-2 border-2 border-dashed border-muted-foreground/50 p-3">
			<p className="font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
				Dev only
			</p>
			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="rounded-full"
					disabled={busy !== null}
					onClick={() => run("draw")}
				>
					<ZapIcon />
					Draw now
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="rounded-full"
					disabled={busy !== null}
					onClick={() => run("advance")}
				>
					<FastForwardIcon />
					Advance a day
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="rounded-full"
					disabled={busy !== null}
					onClick={() => run("reset")}
				>
					<RotateCcwIcon />
					Reset rounds
				</Button>
			</div>
			<p className="font-mono text-xs text-muted-foreground">
				Advance pushes existing rounds back a day (settling streaks) and draws a
				fresh one for today.
			</p>
		</section>
	);
}
