import { createHmac } from "node:crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const CHANNEL_SECRET = process.env.REALTIME_CHANNEL_SECRET;

// Supabase Realtime is a wake-up signal here, never a data source.
//
// We authenticate with Better Auth, not Supabase Auth, so the browser has no
// Supabase JWT and RLS/`auth.uid()` can't scope a subscription. Instead every
// user gets an unguessable channel name (HMAC of their id) handed to them from
// their own authed session, and broadcasts carry an empty payload — the client
// reacts by re-fetching `/api/invites`, which is authed and returns only that
// user's rows. Nothing sensitive crosses the socket, and knowing someone's user
// id doesn't let you listen to them.
export function userChannel(userId: string) {
	if (!CHANNEL_SECRET) {
		throw new Error("REALTIME_CHANNEL_SECRET is not set");
	}
	const digest = createHmac("sha256", CHANNEL_SECRET)
		.update(userId)
		.digest("hex");
	return `user-${digest.slice(0, 32)}`;
}

// Fire-and-forget over Realtime's REST broadcast endpoint — no socket to open
// or tear down inside a route handler. Best-effort by design: if Realtime is
// down or unconfigured the client's SWR poll/refocus still picks the change up,
// so a failed ping must never fail the request that triggered it.
export async function notifyUser(userId: string, event: string) {
	if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !CHANNEL_SECRET) return;

	try {
		await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				apikey: SUPABASE_ANON_KEY,
				Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
			},
			body: JSON.stringify({
				messages: [{ topic: userChannel(userId), event, payload: {} }],
			}),
		});
	} catch (err) {
		console.error(`realtime broadcast to ${event} failed`, err);
	}
}
