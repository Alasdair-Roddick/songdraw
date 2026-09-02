"use client";

import { useRouter } from "next/navigation";
import { useRealtimeSignal } from "@/hooks/use-realtime";

/**
 * Drop into a server-rendered page to make it re-render whenever anything in
 * the given channels changes. Renders nothing — it just wires the socket to
 * router.refresh(), so the page's own server queries stay the source of truth.
 */
export function LiveRefresh({ channels }: { channels: string[] }) {
	const router = useRouter();
	useRealtimeSignal(channels, () => router.refresh());
	return null;
}
