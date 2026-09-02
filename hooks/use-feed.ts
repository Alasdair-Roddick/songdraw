"use client";

import { useCallback, useEffect } from "react";
import useSWR from "swr";
import { useFreshnessRecovery } from "@/hooks/use-freshness-recovery";
import { useRealtimeSignal } from "@/hooks/use-realtime";
import type { FeedEntry } from "@/lib/round";

const fetcher = (url: string) =>
	fetch(url).then((res) => {
		if (!res.ok) throw new Error("failed to load feed");
		return res.json();
	});

export function useFeed(channels: string[]) {
	const { data, mutate, isLoading } = useSWR<FeedEntry[]>(
		"/api/feed",
		fetcher,
		{
			// The feed is the daily play surface. Realtime is an accelerator; a
			// visible client must become correct without it.
			refreshInterval: 10_000,
			revalidateOnFocus: true,
			keepPreviousData: true,
		},
	);

	useRealtimeSignal(channels, () => {
		mutate();
	});

	useFreshnessRecovery(() => {
		mutate();
	});

	// The 17:00 reveal is a clock event, not a message — nobody broadcasts it.
	// Schedule a refetch for the exact moment each locked round unlocks, so the
	// answer appears without waiting for the next poll.
	useEffect(() => {
		if (!data) return;

		const timers = data
			.filter((entry) => entry.round.state === "locked")
			.map((entry) => {
				const at = new Date(
					(entry.round as { revealAt: string }).revealAt,
				).getTime();
				const delay = at - Date.now();
				// Past-due rounds are handled by the poll; setTimeout maxes out
				// around 24 days, and anything beyond that isn't today's round.
				if (delay <= 0 || delay > 2 ** 31 - 1) return null;
				return setTimeout(() => mutate(), delay + 500);
			})
			.filter(
				(timer): timer is ReturnType<typeof setTimeout> => timer !== null,
			);

		return () => {
			for (const timer of timers) clearTimeout(timer);
		};
	}, [data, mutate]);

	/**
	 * Swap one game's round in place after an action, then revalidate. The
	 * guess endpoint returns the resulting view, so the UI can move instantly
	 * instead of waiting on a broadcast that may not be configured.
	 */
	const applyRound = useCallback(
		(gameId: string, round: FeedEntry["round"]) =>
			mutate(
				(current) =>
					current?.map((entry) =>
						entry.gameId === gameId ? { ...entry, round } : entry,
					),
				{ revalidate: true },
			),
		[mutate],
	);

	return { entries: data ?? [], isLoading, refresh: mutate, applyRound };
}
