import { timingSafeEqual } from "node:crypto";

// A denylist of shipped examples, never of live or retired credentials.
const PLACEHOLDER_TOKENS = new Set([
	"changeme",
	"replace-with-openssl-rand-hex-32",
]);

export function validInternalToken(token: string | undefined): token is string {
	return (
		!!token &&
		token.length >= 32 &&
		!PLACEHOLDER_TOKENS.has(token) &&
		!/[\r\n]/.test(token)
	);
}

export function constantTimeEqual(actual: string, expected: string) {
	const a = Buffer.from(actual);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}

export function authorizedBearer(
	request: Request,
	token: string | undefined,
): token is string {
	return (
		validInternalToken(token) &&
		constantTimeEqual(
			request.headers.get("authorization") ?? "",
			`Bearer ${token}`,
		)
	);
}

/** Small, bounded per-process budget, shared by all callers of each route.
 * No caller-controlled IP/header can create unlimited buckets or evade it.
 *
 * The bucket key is a route for the internal API, but it is also keyed by user
 * id where a limit is per person (see lib/feature-request.ts). There are many
 * more accounts than routes, so expired buckets are swept before the map can
 * grow a permanent entry for everyone who ever called. */
export function createInternalRateLimiter(limit = 10, windowMs = 60_000) {
	const routes = new Map<string, number[]>();
	return (route: string, now = Date.now()) => {
		if (routes.size > 1_000) {
			for (const [key, times] of routes) {
				if (times.every((time) => time <= now - windowMs)) routes.delete(key);
			}
		}
		const recent = (routes.get(route) ?? []).filter(
			(time) => time > now - windowMs,
		);
		if (recent.length >= limit) return false;
		recent.push(now);
		routes.set(route, recent);
		return true;
	};
}

export const allowInternalRequest = createInternalRateLimiter();

export function rateLimitResponse() {
	return Response.json(
		{ error: "Too many requests; retry in one minute." },
		{ status: 429, headers: { "Retry-After": "60" } },
	);
}
