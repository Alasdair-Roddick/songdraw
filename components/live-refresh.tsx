"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFreshnessRecovery } from "@/hooks/use-freshness-recovery";
import { useRealtimeSignal } from "@/hooks/use-realtime";

/**
 * Drop into a server-rendered page to make it re-render whenever anything in
 * the given channels changes. Renders nothing — it just wires the socket to
 * router.refresh(), so the page's own server queries stay the source of truth.
 */
export function LiveRefresh({ channels }: { channels: string[] }) {
	const router = useRouter();
	useRealtimeSignal(channels, () => router.refresh());
	useFreshnessRecovery(() => router.refresh());

	// Unlike SWR-backed views, this component refreshes server-rendered pages.
	// Keep a correctness floor here too: mobile browsers are free to suspend the
	// Supabase socket and this page has no client-side data cache to repair it.
	useEffect(() => {
		const timer = window.setInterval(() => router.refresh(), 10_000);
		return () => window.clearInterval(timer);
	}, [router]);

	return null;
}
