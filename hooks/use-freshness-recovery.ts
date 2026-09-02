"use client";

import { useEffect, useRef } from "react";

/**
 * iOS can freeze a tab (including timers and WebSockets) without closing it.
 * Reconcile immediately whenever the browser makes the page active again,
 * rather than waiting for the next polling interval or a socket reconnect.
 */
export function useFreshnessRecovery(refresh: () => void) {
	const callback = useRef(refresh);
	callback.current = refresh;

	useEffect(() => {
		const reconcile = () => {
			if (document.visibilityState === "visible") callback.current();
		};

		document.addEventListener("visibilitychange", reconcile);
		window.addEventListener("focus", reconcile);
		window.addEventListener("online", reconcile);
		// Safari restores some navigations from the back-forward cache without a
		// new load or focus event, so pageshow is needed as well.
		window.addEventListener("pageshow", reconcile);

		return () => {
			document.removeEventListener("visibilitychange", reconcile);
			window.removeEventListener("focus", reconcile);
			window.removeEventListener("online", reconcile);
			window.removeEventListener("pageshow", reconcile);
		};
	}, []);
}
