import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

/**
 * Filing a feature request with the admin console.
 *
 * The console keeps its own database and its game-facing credential is
 * read-only, so a feature request cannot live in a table here that the console
 * then triages — every triage action is a write. The direction is inverted
 * instead: the game POSTs the request in, and everything after that (status,
 * internal notes, the emails back to the submitter) happens over there and
 * never touches this database again. See docs/feature-requests.md.
 *
 * The envelope is the one docs/admin-write-api.md describes with the direction
 * reversed — lib/admin-contract.ts is the verify half of this shape, this is
 * the sign half. Two differences from that file, both the console's call and
 * not ours to reconcile: the signature travels as bare hex rather than
 * `v1=<hex>`, and the secret is INGEST_SHARED_SECRET, not ADMIN_API_TOKEN.
 * Those are deliberately different keys — ADMIN_API_TOKEN rewrites a live
 * game, this one files a feature request, and this app is the internet-facing
 * half.
 */

const PATH = "/api/ingest/feature-request";

// The console is a homelab behind Cloudflare. A player waiting on a form
// submit must not wait on it indefinitely.
const TIMEOUT_MS = 10_000;

export const FIELD_LIMITS = {
	title: 200,
	body: 4000,
	category: 60,
	submitterName: 120,
	submitterEmail: 320,
} as const;

export type FeatureRequestInput = {
	externalId: string;
	submitterUserId: string | null;
	submitterName: string;
	submitterEmail: string;
	title: string;
	body: string;
	category?: string | null;
};

export type FileResult =
	| { outcome: "filed"; id: string; duplicate: boolean }
	| { outcome: "refused"; status: number; message: string }
	| { outcome: "unknown"; message: string };

export function ingestConfigured() {
	return Boolean(
		process.env.ADMIN_INGEST_URL && process.env.INGEST_SHARED_SECRET,
	);
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/**
 * The signature protects the body, not the transport, and the body carries a
 * real person's name and email address. Plain http is allowed only where it
 * cannot leave the machine.
 */
export function ingestEndpoint(baseUrl: string) {
	const url = new URL(PATH, baseUrl);
	if (url.protocol !== "https:" && !LOOPBACK.has(url.hostname)) {
		throw new Error("ADMIN_INGEST_URL must be https outside loopback.");
	}
	return url;
}

/**
 * A retry has to reuse the externalId of the attempt it is retrying, or it
 * files a second copy — so the id is derived rather than rolled: from the
 * caller's own id and a key the client holds for the life of one filled-in
 * form. Hashing the pair, rather than trusting a client-supplied id, means one
 * player cannot choose an id that collides with another player's request and
 * have theirs silently swallowed as a duplicate.
 */
export function externalIdFor(userId: string, clientKey: string) {
	// Length-prefixed, not separator-joined: with a plain separator the pair
	// ("usr_a", "b key") and the pair ("usr_a b", "key") hash identically, and
	// one player could then claim an id another player was going to mint.
	const digest = createHash("sha256")
		.update(`${userId.length}:${userId}:${clientKey}`, "utf8")
		.digest("hex");
	return `fr_${digest.slice(0, 32)}`;
}

export const newExternalId = () => `fr_${randomUUID()}`;

/** The canonical string the console re-derives and verifies against. Seven
 * fields, newline-joined, no trailing newline. */
export function canonicalString(parts: {
	timestamp: string;
	nonce: string;
	actor: string;
	body: string;
}) {
	// Method and path are signed on purpose: without them a signature is bound
	// only to a body, and a captured request replays against any other endpoint
	// whose body shape it happens to satisfy.
	return [
		"v1",
		"POST",
		PATH,
		parts.timestamp,
		parts.nonce,
		parts.actor,
		createHash("sha256").update(parts.body, "utf8").digest("hex"),
	].join("\n");
}

export async function fileFeatureRequest(
	input: FeatureRequestInput,
): Promise<FileResult> {
	const baseUrl = process.env.ADMIN_INGEST_URL;
	const secret = process.env.INGEST_SHARED_SECRET;
	if (!baseUrl || !secret) {
		return { outcome: "refused", status: 0, message: "ingest not configured" };
	}

	// Serialise ONCE. This exact string is both hashed and transmitted: two
	// JSON encoders that disagree about key order or unicode escaping would
	// otherwise produce a valid signature over a body the console never saw.
	const body = JSON.stringify(input);
	const timestamp = Math.floor(Date.now() / 1000).toString();
	const nonce = randomBytes(16).toString("hex");
	const actor = input.submitterUserId ?? "anonymous";

	// A newline in any signed field forges the canonical string's boundaries.
	// Only the actor is data rather than something we mint here, and it is a
	// generated user id — so this guards a future shape change rather than
	// today's input, which is why it throws instead of refusing politely.
	if (/[\r\n]/.test(actor)) {
		throw new Error("Feature request actor must not contain newlines.");
	}

	const signature = createHmac("sha256", secret)
		.update(canonicalString({ timestamp, nonce, actor, body }), "utf8")
		.digest("hex");

	let endpoint: URL;
	try {
		endpoint = ingestEndpoint(baseUrl);
	} catch (error) {
		return {
			outcome: "refused",
			status: 0,
			message: error instanceof Error ? error.message : "bad ingest URL",
		};
	}

	try {
		const response = await fetch(endpoint, {
			method: "POST",
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: {
				"content-type": "application/json",
				"x-songdraw-timestamp": timestamp,
				"x-songdraw-nonce": nonce,
				"x-songdraw-actor": actor,
				"x-songdraw-signature": signature,
			},
			body,
		});

		const payload = (await response.json().catch(() => ({}))) as {
			id?: string;
			duplicate?: boolean;
			error?: string;
		};

		if (response.ok && payload.id) {
			return {
				outcome: "filed",
				id: payload.id,
				duplicate: payload.duplicate ?? false,
			};
		}
		return {
			outcome: "refused",
			status: response.status,
			message: payload.error ?? `admin console answered ${response.status}`,
		};
	} catch (error) {
		// A timeout is NOT a refusal. The request may well have been filed, so
		// the caller must never retry it under a fresh externalId.
		return {
			outcome: "unknown",
			message: error instanceof Error ? error.message : "no answer",
		};
	}
}
