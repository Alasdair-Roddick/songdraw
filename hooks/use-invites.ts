"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { supabase } from "@/lib/supabase-browser";

export type Invite = {
	id: string;
	createdAt: string;
	game: { id: string; name: string };
	inviter: { id: string; name: string; image: string | null };
};

const fetcher = (url: string) =>
	fetch(url).then((res) => {
		if (!res.ok) throw new Error("failed to load invites");
		return res.json();
	});

export function useInvites(channel: string | null) {
	const { data, mutate, isLoading } = useSWR<Invite[]>(
		"/api/invites",
		fetcher,
		{
			// Realtime is the fast path; this is the floor that keeps the bell
			// correct when the socket is down, unconfigured, or the tab slept.
			refreshInterval: 60_000,
			revalidateOnFocus: true,
		},
	);

	// Re-fetch on any ping to our private channel. The broadcast payload is
	// empty on purpose — the authed endpoint is the only source of truth.
	useEffect(() => {
		const client = supabase;
		if (!client || !channel) return;

		const subscription = client
			.channel(channel)
			.on("broadcast", { event: "*" }, () => {
				mutate();
			})
			.subscribe();

		return () => {
			client.removeChannel(subscription);
		};
	}, [channel, mutate]);

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
			toast(`${invite.inviter.name} invited you to ${invite.game.name}`, {
				description: "Open the bell to accept or decline.",
			});
		}
	}, [data]);

	return { invites: data ?? [], isLoading, refresh: mutate };
}
