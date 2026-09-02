"use client";

import { BellIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useInvites } from "@/hooks/use-invites";

export function NotificationBell({ channel }: { channel: string | null }) {
	const router = useRouter();
	const { invites, refresh } = useInvites(channel);
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState<string | null>(null);

	async function respond(id: string, action: "accept" | "decline") {
		setBusy(id);
		const res = await fetch(`/api/invites/${id}`, {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ action }),
		});
		setBusy(null);

		if (!res.ok) {
			toast.error("Couldn't respond to that invite — try again.");
			return;
		}

		const body = await res.json().catch(() => null);
		await refresh();

		if (action === "accept") {
			toast.success(`You're in — ${body?.game?.name ?? "game joined"}`);
			router.refresh();
		}
		if (invites.length <= 1) setOpen(false);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					className="relative"
					aria-label={
						invites.length
							? `${invites.length} pending invite${invites.length > 1 ? "s" : ""}`
							: "Notifications"
					}
				>
					<BellIcon />
					{invites.length > 0 && (
						<span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 font-mono text-[10px] font-bold text-brand-foreground tabular-nums">
							{invites.length}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-80 rounded-none border-2 border-foreground p-0 shadow-[4px_4px_0_0_var(--color-foreground)]"
			>
				<p className="border-b-2 border-foreground px-3 py-2 font-mono text-xs font-semibold tracking-widest uppercase text-muted-foreground">
					Invites
				</p>
				{invites.length === 0 ? (
					<p className="px-3 py-6 text-center font-mono text-sm text-muted-foreground">
						Nothing pending.
					</p>
				) : (
					<ul className="divide-y-2 divide-foreground">
						{invites.map((invite) => (
							<li key={invite.id} className="flex flex-col gap-3 p-3">
								<div className="flex items-center gap-2.5">
									<Avatar>
										{invite.inviter.image && (
											<AvatarImage
												src={invite.inviter.image}
												alt={invite.inviter.name}
											/>
										)}
										<AvatarFallback>
											{invite.inviter.name.charAt(0).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<p className="text-sm leading-snug">
										<span className="font-bold">{invite.inviter.name}</span>{" "}
										invited you to{" "}
										<span className="font-bold">{invite.game.name}</span>
									</p>
								</div>
								<div className="flex gap-2">
									<Button
										type="button"
										variant="brand"
										size="sm"
										className="flex-1 rounded-full"
										disabled={busy === invite.id}
										onClick={() => respond(invite.id, "accept")}
									>
										Accept
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="flex-1 rounded-full"
										disabled={busy === invite.id}
										onClick={() => respond(invite.id, "decline")}
									>
										Decline
									</Button>
								</div>
							</li>
						))}
					</ul>
				)}
			</PopoverContent>
		</Popover>
	);
}
