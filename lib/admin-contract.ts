import { createHash, createHmac } from "node:crypto";
import { constantTimeEqual } from "@/lib/internal-security";
import { MutationError } from "@/lib/mutation";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function adminEnvelope(request: Request, now = Date.now()) {
	const timestamp = request.headers.get("x-admin-timestamp") ?? "";
	if (
		!/^\d{1,12}$/.test(timestamp) ||
		Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 60
	) {
		throw new MutationError(401, "Admin timestamp must be within 60 seconds.");
	}
	const nonce = request.headers.get("x-admin-nonce") ?? "";
	const actor = request.headers.get("x-admin-actor") ?? "";
	const correlationId = request.headers.get("x-admin-correlation-id") ?? "";
	const key = request.headers.get("idempotency-key") ?? "";
	const signature = request.headers.get("x-admin-signature") ?? "";
	if (!/^[0-9a-f]{32}$/.test(nonce))
		throw new MutationError(
			400,
			"Admin nonce must be 32 lowercase hex characters.",
		);
	if (actor.length > 320 || !/^[^\s@]+@[^\s@]+$/.test(actor))
		throw new MutationError(400, "Admin actor must be an email address.");
	if (!UUID.test(key) || !UUID.test(correlationId))
		throw new MutationError(
			400,
			"Idempotency key and correlation ID must be UUIDs.",
		);
	const path = new URL(request.url).pathname;
	if (
		[
			request.method,
			path,
			timestamp,
			nonce,
			actor,
			correlationId,
			key,
			signature,
		].some((value) => /[\r\n]/.test(value))
	)
		throw new MutationError(400, "Admin fields must not contain newlines.");
	return { timestamp, nonce, actor, correlationId, key, signature, path };
}

export function verifyAdminSignature(
	request: Request,
	envelope: ReturnType<typeof adminEnvelope>,
	rawBody: Uint8Array,
	token: string,
) {
	const bodyHash = createHash("sha256").update(rawBody).digest("hex");
	const canonical = [
		"v1",
		request.method,
		envelope.path,
		envelope.timestamp,
		envelope.nonce,
		envelope.actor,
		bodyHash,
	].join("\n");
	const expected = `v1=${createHmac("sha256", token).update(canonical).digest("hex")}`;
	if (
		!/^v1=[0-9a-f]{64}$/.test(envelope.signature) ||
		!constantTimeEqual(envelope.signature, expected)
	)
		throw new MutationError(401, "Invalid admin signature.");
	return bodyHash;
}

/** Bound memory even for chunked requests without Content-Length. */
export async function readAdminBody(request: Request) {
	const reader = request.body?.getReader();
	if (!reader) return Buffer.alloc(0);
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			if (size > 16_384) {
				await reader.cancel();
				throw new MutationError(413, "Admin request body is too large.");
			}
			chunks.push(value);
		}
	} finally {
		reader.releaseLock();
	}
	return Buffer.concat(chunks);
}
