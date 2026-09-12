import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import {
	adminEnvelope,
	readAdminBody,
	verifyAdminSignature,
} from "../lib/admin-contract";
import {
	authorizedBearer,
	createInternalRateLimiter,
	validInternalToken,
} from "../lib/internal-security";

const token = "contract-test-secret-not-a-live-token-123456789";
const now = 1_767_225_600_500;

function signed(raw = '{ "status": "archived", "gameId": "café" }') {
	const timestamp = String(Math.floor(now / 1000));
	const nonce = randomBytes(16).toString("hex");
	const actor = "operator@example.com";
	const path = "/api/internal/admin/game/archive";
	// Independent implementation of the client contract, not a server signer.
	const canonical = [
		"v1",
		"POST",
		path,
		timestamp,
		nonce,
		actor,
		createHash("sha256").update(raw).digest("hex"),
	].join("\n");
	return new Request(`https://songdraw.test${path}`, {
		method: "POST",
		body: raw,
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
			"X-Admin-Timestamp": timestamp,
			"X-Admin-Nonce": nonce,
			"X-Admin-Actor": actor,
			"X-Admin-Correlation-Id": randomUUID(),
			"Idempotency-Key": randomUUID(),
			"X-Admin-Signature": `v1=${createHmac("sha256", token).update(canonical).digest("hex")}`,
		},
	});
}

test("signature uses exact UTF-8 bytes, and binds actor, method, path, timestamp and nonce", async () => {
	const request = signed();
	const raw = await readAdminBody(request);
	const envelope = adminEnvelope(request, now);
	assert.doesNotThrow(() =>
		verifyAdminSignature(request, envelope, raw, token),
	);
	assert.throws(() =>
		verifyAdminSignature(
			request,
			envelope,
			Buffer.from(JSON.stringify(JSON.parse(raw.toString()))),
			token,
		),
	);
	for (const change of [
		{ actor: "someone@example.com" },
		{ path: "/api/internal/admin/member/remove" },
		{ timestamp: String(Number(envelope.timestamp) + 1) },
		{ nonce: "a".repeat(32) },
	]) {
		assert.throws(() =>
			verifyAdminSignature(request, { ...envelope, ...change }, raw, token),
		);
	}
	assert.throws(() =>
		verifyAdminSignature(
			new Request(request.url, { method: "PUT" }),
			envelope,
			raw,
			token,
		),
	);
	assert.throws(() =>
		verifyAdminSignature(request, envelope, raw, `${token}wrong`),
	);
});

test("timestamp window includes exactly plus/minus 60 seconds", () => {
	for (const seconds of [-60, 60])
		assert.doesNotThrow(() => adminEnvelope(signed(), now + seconds * 1000));
	for (const seconds of [-61, 61])
		assert.throws(() => adminEnvelope(signed(), now + seconds * 1000));
	for (const timestamp of ["", "1767225600000", "1.7672256e9", "NaN"]) {
		const request = signed();
		request.headers.set("x-admin-timestamp", timestamp);
		assert.throws(() => adminEnvelope(request, now));
	}
});

test("unsafe secrets and malformed envelopes refuse", () => {
	for (const value of [
		undefined,
		"",
		"changeme",
		"replace-with-openssl-rand-hex-32",
		"x".repeat(31),
		`${token}\n`,
	])
		assert.equal(validInternalToken(value), false);
	assert.equal(authorizedBearer(signed(), token), true);
	assert.equal(authorizedBearer(signed(), `${token}x`), false);
	for (const header of [
		"x-admin-nonce",
		"x-admin-actor",
		"idempotency-key",
		"x-admin-correlation-id",
	]) {
		const request = signed();
		request.headers.set(header, "invalid");
		assert.throws(() => adminEnvelope(request, now));
	}
});

test("oversized chunked bodies refuse and route budgets recover", async () => {
	await assert.rejects(() => readAdminBody(signed("x".repeat(16_385))), {
		status: 413,
	});
	const allow = createInternalRateLimiter(2);
	assert.equal(allow("draw", 0), true);
	assert.equal(allow("draw", 1), true);
	assert.equal(allow("draw", 2), false);
	assert.equal(allow("archive", 2), true);
	assert.equal(allow("draw", 60_000), true);
});
