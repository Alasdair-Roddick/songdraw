"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useFreshnessRecovery } from "@/hooks/use-freshness-recovery";
import { supabase } from "@/lib/supabase-browser";

export type Invite = {
	id: string;
	createdAt: string;
	game: { id: string; name: string };
	inviter: { id: string; name: string; image: string | null };
};

export type InviteAction = "accept" | "decline";

const fetcher = (url: string) =>
	fetch(url).then((res) => {
		if (!res.ok) throw new Error("failed to load invites");
		return res.json();
	});

export function useInvites(channel: string | null) {
	const router = useRouter();
	const [busyId, setBusyId] = useState<string | null>(null);

	const { data, mutate } = useSWR<Invite[]>("/api/invites", fetcher, {
		// Realtime is the fast path; a visible mobile client still reconciles
		// quickly when its socket was suspended in the background.
		refreshInterval: 10_000,
		revalidateOnFocus: true,
	});

	const respond = useCallback(
		async (invite: Invite, action: InviteAction) => {
			setBusyId(invite.id);

			// Drop it from the list immediately — the bell badge and any open
			// toast should react on tap, not after the round trip.
			await mutate(
				(current) => current?.filter((row) => row.id !== invite.id),
				{ revalidate: false },
			);

			const res = await fetch(`/api/invites/${invite.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action }),
			});
			setBusyId(null);

			if (!res.ok) {
				toast.error("Couldn't respond to that invite — try again.");
				await mutate();
				return;
			}

			if (action === "accept") {
				toast.success(`You're in — ${invite.game.name}`);
				router.refresh();
			}
			await mutate();
		},
		[mutate, router],
	);

	useFreshnessRecovery(() => {
		mutate();
		router.refresh();
	});

	// One subscription for the whole app. Beyond refreshing the bell it also
	// re-renders the current page, so an inviter sitting on the game page sees
	// a member appear the moment they accept.
	useEffect(() => {
		const client = supabase;
		if (!client || !channel) return;

		const subscription = client
			.channel(channel)
			.on("broadcast", { event: "*" }, () => {
				mutate();
				router.refresh();
			})
			.subscribe((status) => {
				if (status === "SUBSCRIBED") {
					mutate();
					router.refresh();
				}
			});

		return () => {
			client.removeChannel(subscription);
		};
	}, [channel, mutate, router]);

	// Toast only genuinely new invites. The first successful load seeds the
	// baseline so opening the app doesn't replay every pending invite as news.
	const seen = useRef<Set<string> | null>(null);
	useEffect(() => {
		if (!data) return;

		if (seen.current === null) {
			seen.current = new Set(data.map((invite) => invite.id));
			return;
		}

		for (const invite of data) {
			if (seen.current.has(invite.id)) continue;
			seen.current.add(invite.id);

			toast.custom(
				(id) => (
					<InviteToast
						invite={invite}
						onRespond={(action) => {
							toast.dismiss(id);
							respond(invite, action);
						}}
					/>
				),
				{ duration: 15_000 },
			);
		}
	}, [data, respond]);

	return { invites: data ?? [], respond, busyId };
}

// Acting straight from the toast is the primary path; the bell exists for the
// ones you swipe away or never saw.
function InviteToast({
	invite,
	onRespond,
}: {
	invite: Invite;
	onRespond: (action: InviteAction) => void;
}) {
	return (
		<div className="flex w-full flex-col gap-3 border-2 border-foreground bg-background p-3 shadow-[4px_4px_0_0_var(--color-foreground)]">
			<div className="flex items-center gap-2.5">
				<Avatar>
					{invite.inviter.image && (
						<AvatarImage src={invite.inviter.image} alt={invite.inviter.name} />
					)}
					<AvatarFallback>
						{invite.inviter.name.charAt(0).toUpperCase()}
					</AvatarFallback>
				</Avatar>
				<p className="text-sm leading-snug">
					<span className="font-bold">{invite.inviter.name}</span> invited you
					to <span className="font-bold">{invite.game.name}</span>
				</p>
			</div>
			<div className="flex gap-2">
				<Button
					type="button"
					variant="brand"
					size="sm"
					className="flex-1 rounded-full"
					onClick={() => onRespond("accept")}
				>
					Accept
				</Button>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="flex-1 rounded-full"
					onClick={() => onRespond("decline")}
				>
					Decline
				</Button>
			</div>
		</div>
	);
}
