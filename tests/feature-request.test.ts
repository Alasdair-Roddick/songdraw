import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";
import {
	canonicalString,
	externalIdFor,
	fileFeatureRequest,
	ingestConfigured,
	ingestEndpoint,
} from "../lib/feature-request";
import { createInternalRateLimiter } from "../lib/internal-security";

const secret = "feature-request-test-secret-not-a-live-token-123456789";

const input = {
	// Deliberately non-ASCII: a body with unicode is where two JSON encoders
	// most often disagree, and the signature has to survive it.
	externalId: "fr_0123456789abcdef0123456789abcdef",
	submitterUserId: "usr_abc",
	submitterName: "Renée",
	submitterEmail: "renee@example.com",
	title: "Let me undo a guess",
	body: "I keep fat-fingering the picker — 「やめて」",
	category: "gameplay",
};

type Captured = { url: string; init: RequestInit & { body: string } };

/** Runs `fileFeatureRequest` against a stubbed fetch, returning what went out.
 * `answer` plays the part of the console. */
async function send(
	answer: (captured: Captured) => Response | Promise<Response> | never,
	env: Record<string, string | undefined> = {},
) {
	const previous = {
		ADMIN_INGEST_URL: process.env.ADMIN_INGEST_URL,
		INGEST_SHARED_SECRET: process.env.INGEST_SHARED_SECRET,
	};
	const applied: Record<string, string | undefined> = {
		ADMIN_INGEST_URL: "https://admin.test",
		INGEST_SHARED_SECRET: secret,
		...env,
	};
	for (const [key, value] of Object.entries(applied)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}

	const realFetch = globalThis.fetch;
	let captured: Captured | null = null;
	globalThis.fetch = (async (url: URL | string, init: RequestInit) => {
		captured = { url: String(url), init: init as Captured["init"] };
		return await answer(captured);
	}) as typeof fetch;

	try {
		const result = await fileFeatureRequest(input);
		return { result, captured: captured as Captured | null };
	} finally {
		globalThis.fetch = realFetch;
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
}

const ok = (payload: object, status = 201) =>
	new Response(JSON.stringify(payload), {
		status,
		headers: { "content-type": "application/json" },
	});

test("signs the exact bytes it sends, binding method, path, timestamp, nonce and actor", async () => {
	const { result, captured } = await send(() =>
		ok({ id: "req_1", status: "pending", duplicate: false }),
	);
	assert.deepEqual(result, { outcome: "filed", id: "req_1", duplicate: false });
	assert.ok(captured);

	const headers = captured.init.headers as Record<string, string>;
	const sent = captured.init.body;
	assert.equal(captured.url, "https://admin.test/api/ingest/feature-request");
	assert.equal(captured.init.method, "POST");
	assert.equal(headers["x-songdraw-actor"], "usr_abc");
	assert.match(headers["x-songdraw-nonce"], /^[0-9a-f]{32}$/);
	assert.match(headers["x-songdraw-timestamp"], /^\d{1,12}$/);

	// The console's half, implemented independently of the signer.
	const verify = (body: string, path = "/api/ingest/feature-request") =>
		createHmac("sha256", secret)
			.update(
				[
					"v1",
					"POST",
					path,
					headers["x-songdraw-timestamp"],
					headers["x-songdraw-nonce"],
					headers["x-songdraw-actor"],
					createHash("sha256").update(body, "utf8").digest("hex"),
				].join("\n"),
				"utf8",
			)
			.digest("hex");

	assert.equal(headers["x-songdraw-signature"], verify(sent));
	// Bare hex, not the `v1=` prefix the inbound admin envelope uses.
	assert.match(headers["x-songdraw-signature"], /^[0-9a-f]{64}$/);

	// Re-encoding the body — the classic "hash the object, send the string"
	// bug — must not still verify.
	const reencoded = JSON.stringify(JSON.parse(sent));
	if (reencoded !== sent) {
		assert.notEqual(headers["x-songdraw-signature"], verify(reencoded));
	}
	// A capture replayed at another endpoint must not verify either.
	assert.notEqual(
		headers["x-songdraw-signature"],
		verify(sent, "/api/ingest/other"),
	);
	// And the body carries every field the contract names.
	assert.deepEqual(JSON.parse(sent), input);
});

test("a tampered field breaks the signature", async () => {
	const { captured } = await send(() => ok({ id: "req_1" }));
	assert.ok(captured);
	const headers = captured.init.headers as Record<string, string>;
	const tampered = captured.init.body.replace(
		"renee@example.com",
		"attacker@example.com",
	);
	const expected = createHmac("sha256", secret)
		.update(
			canonicalString({
				timestamp: headers["x-songdraw-timestamp"],
				nonce: headers["x-songdraw-nonce"],
				actor: headers["x-songdraw-actor"],
				body: tampered,
			}),
			"utf8",
		)
		.digest("hex");
	assert.notEqual(headers["x-songdraw-signature"], expected);
});

test("nonce is fresh on every attempt", async () => {
	const first = await send(() => ok({ id: "a" }));
	const second = await send(() => ok({ id: "b" }));
	const nonce = (c: Captured | null) =>
		(c?.init.headers as Record<string, string>)["x-songdraw-nonce"];
	assert.notEqual(nonce(first.captured), nonce(second.captured));
});

test("a duplicate is filed, not refused", async () => {
	const { result } = await send(() =>
		ok({ id: "req_1", status: "pending", duplicate: true }, 200),
	);
	assert.deepEqual(result, { outcome: "filed", id: "req_1", duplicate: true });
});

test("a rejection is refused with the console's status and reason", async () => {
	const { result } = await send(() => ok({ error: "title too long" }, 422));
	assert.deepEqual(result, {
		outcome: "refused",
		status: 422,
		message: "title too long",
	});
});

test("no answer is unknown, never refused — the request may have been filed", async () => {
	const { result } = await send(() => {
		throw new Error("The operation was aborted due to timeout");
	});
	assert.equal(result.outcome, "unknown");
});

test("unconfigured refuses before signing anything", async () => {
	const { result, captured } = await send(() => ok({ id: "req_1" }), {
		INGEST_SHARED_SECRET: undefined,
	});
	assert.deepEqual(result, {
		outcome: "refused",
		status: 0,
		message: "ingest not configured",
	});
	assert.equal(captured, null);
});

test("plain http is refused unless it is loopback", () => {
	assert.throws(() => ingestEndpoint("http://admin.test"));
	assert.doesNotThrow(() => ingestEndpoint("https://admin.test"));
	assert.doesNotThrow(() => ingestEndpoint("http://localhost:3000"));
	assert.doesNotThrow(() => ingestEndpoint("http://127.0.0.1:3000"));
	assert.equal(
		ingestEndpoint("https://admin.test").pathname,
		"/api/ingest/feature-request",
	);
});

test("ingestConfigured needs both halves", () => {
	const previous = [
		process.env.ADMIN_INGEST_URL,
		process.env.INGEST_SHARED_SECRET,
	];
	try {
		process.env.ADMIN_INGEST_URL = "https://admin.test";
		delete process.env.INGEST_SHARED_SECRET;
		assert.equal(ingestConfigured(), false);
		process.env.INGEST_SHARED_SECRET = secret;
		assert.equal(ingestConfigured(), true);
	} finally {
		for (const [index, key] of [
			"ADMIN_INGEST_URL",
			"INGEST_SHARED_SECRET",
		].entries()) {
			if (previous[index] === undefined) delete process.env[key];
			else process.env[key] = previous[index];
		}
	}
});

test("externalId is stable per person and key, and never collides across people", () => {
	assert.equal(
		externalIdFor("usr_a", "key-1"),
		externalIdFor("usr_a", "key-1"),
	);
	assert.notEqual(
		externalIdFor("usr_a", "key-1"),
		externalIdFor("usr_a", "key-2"),
	);
	assert.notEqual(
		externalIdFor("usr_a", "key-1"),
		externalIdFor("usr_b", "key-1"),
	);
	// The separator is not forgeable by splicing the two halves differently.
	assert.notEqual(
		externalIdFor("usr_a", "b key"),
		externalIdFor("usr_a b", "key"),
	);
	assert.match(externalIdFor("usr_a", "key-1"), /^fr_[0-9a-f]{32}$/);
});

test("the filing budget is per person and expires", () => {
	const allow = createInternalRateLimiter(5, 60 * 60 * 1000);
	const start = 1_767_225_600_000;
	for (let i = 0; i < 5; i++) assert.equal(allow("usr_a", start), true);
	assert.equal(allow("usr_a", start), false);
	// One player's spending does not touch another's.
	assert.equal(allow("usr_b", start), true);
	// And the window slides.
	assert.equal(allow("usr_a", start + 60 * 60 * 1000 + 1), true);
});
