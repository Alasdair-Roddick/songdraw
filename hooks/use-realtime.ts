"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase-browser";

/**
 * Subscribe to any number of Realtime channels and run `onSignal` when any of
 * them pings. Payloads are always empty by design (see lib/realtime.ts), so
 * the handler's job is to refetch, never to trust what arrived.
 *
 * Channels are joined by value, not by array identity, so callers can pass a
 * freshly-built array each render without thrashing subscriptions.
 */
export function useRealtimeSignal(channels: string[], onSignal: () => void) {
	// Keeps the effect from re-subscribing just because the caller passed a new
	// function instance.
	const handler = useRef(onSignal);
	handler.current = onSignal;

	const key = channels.filter(Boolean).sort().join("|");

	useEffect(() => {
		const client = supabase;
		if (!client || !key) return;

		const subscriptions = key.split("|").map((name) =>
			client
				.channel(name)
				.on("broadcast", { event: "*" }, () => handler.current())
				.subscribe((status) => {
					// A mobile browser may drop the socket while it is suspended. A
					// successful rejoin is a cue to reconcile, not proof that every
					// broadcast was received while it was away.
					if (status === "SUBSCRIBED") handler.current();
				}),
		);

		return () => {
			for (const subscription of subscriptions) {
				client.removeChannel(subscription);
			}
		};
	}, [key]);
}
