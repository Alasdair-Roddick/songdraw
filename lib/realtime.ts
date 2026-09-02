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
function channelFor(kind: string, id: string) {
	if (!CHANNEL_SECRET) {
		throw new Error("REALTIME_CHANNEL_SECRET is not set");
	}
	const digest = createHmac("sha256", CHANNEL_SECRET)
		.update(`${kind}:${id}`)
		.digest("hex");
	return `${kind}-${digest.slice(0, 32)}`;
}

/** Private to one user — invites, and anything addressed only to them. */
export function userChannel(userId: string) {
	return channelFor("user", userId);
}

/**
 * Shared by everyone in a game. Handed only to members (from their own authed
 * session), and like the user channel it carries empty payloads — so even if a
 * channel name leaked, it reveals that something changed, never what.
 *
 * This is what makes a guess visible to the whole room at once: the waiting
 * count drops for everybody, and when the last person guesses the reveal fires
 * for all of them together.
 */
export function gameChannel(gameId: string) {
	return channelFor("game", gameId);
}

// Fire-and-forget over Realtime's REST broadcast endpoint — no socket to open
// or tear down inside a route handler. Best-effort by design: if Realtime is
// down or unconfigured the client's SWR poll/refocus still picks the change up,
// so a failed ping must never fail the request that triggered it.
async function broadcast(topic: string, event: string) {
	if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !CHANNEL_SECRET) return;

	try {
		await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				apikey: SUPABASE_ANON_KEY,
				Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
			},
			body: JSON.stringify({ messages: [{ topic, event, payload: {} }] }),
		});
	} catch (err) {
		console.error(`realtime broadcast ${event} failed`, err);
	}
}

export async function notifyUser(userId: string, event: string) {
	await broadcast(userChannel(userId), event);
}

/** Ping every member of a game — a guess, a draw, a roster change. */
export async function notifyGame(gameId: string, event: string) {
	await broadcast(gameChannel(gameId), event);
}
