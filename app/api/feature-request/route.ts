import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
	externalIdFor,
	FIELD_LIMITS,
	fileFeatureRequest,
	ingestConfigured,
	newExternalId,
} from "@/lib/feature-request";
import {
	createInternalRateLimiter,
	rateLimitResponse,
} from "@/lib/internal-security";

/**
 * Player-facing half of the feature-request contract (docs/feature-requests.md).
 * Nothing is stored here: the request is signed and POSTed to the admin
 * console, which owns it from that point on.
 */

// Per person, per hour, per process. Every filed request sends an
// acknowledgement email from the console's domain, so without a ceiling one
// bored player can empty its Resend quota.
const allowFiling = createInternalRateLimiter(5, 60 * 60 * 1000);

// Only what the console accepts as a category. Free text up to 60 chars is
// allowed by the contract, but a fixed set is what the form offers and what
// makes the console's triage list sortable.
const CATEGORIES = new Set(["gameplay", "bug", "design", "other"]);

function text(value: unknown) {
	return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: Request) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	// Answer before signing anything: an unconfigured deploy is our problem,
	// not something the player should be told to retry into forever.
	if (!ingestConfigured()) {
		console.error(
			"feature request submitted but ADMIN_INGEST_URL/INGEST_SHARED_SECRET unset",
		);
		return NextResponse.json(
			{ error: "Feature requests aren't switched on right now." },
			{ status: 503 },
		);
	}

	const payload = await request.json().catch(() => null);
	const title = text(payload?.title);
	const body = text(payload?.body);
	const category = text(payload?.category).toLowerCase();
	// Minted by the client before its first attempt and reused on every retry,
	// so a retry after a timeout files nothing new. A missing one only costs
	// that idempotency, so it is not worth rejecting the request over.
	const clientKey = text(payload?.clientKey).slice(0, 200);

	if (!title || title.length > FIELD_LIMITS.title) {
		return NextResponse.json(
			{ error: `Give it a title, up to ${FIELD_LIMITS.title} characters.` },
			{ status: 400 },
		);
	}
	if (!body || body.length > FIELD_LIMITS.body) {
		return NextResponse.json(
			{ error: `Describe it, up to ${FIELD_LIMITS.body} characters.` },
			{ status: 400 },
		);
	}
	if (category && !CATEGORIES.has(category)) {
		return NextResponse.json({ error: "Unknown category." }, { status: 400 });
	}

	if (!allowFiling(session.user.id)) {
		return rateLimitResponse();
	}

	// Name and email come from the session, never from the body: a
	// body-supplied address would make this an open relay for the console's
	// own sending domain.
	const result = await fileFeatureRequest({
		externalId: clientKey
			? externalIdFor(session.user.id, clientKey)
			: newExternalId(),
		submitterUserId: session.user.id,
		submitterName: session.user.name.slice(0, FIELD_LIMITS.submitterName),
		submitterEmail: session.user.email.slice(0, FIELD_LIMITS.submitterEmail),
		title,
		body,
		category: category || null,
	});

	if (result.outcome === "filed") {
		return NextResponse.json(
			{
				duplicate: result.duplicate,
				message: result.duplicate
					? "You've already sent this one."
					: "Thanks — check your email.",
			},
			{ status: result.duplicate ? 200 : 201 },
		);
	}

	if (result.outcome === "refused") {
		console.error(
			`feature request refused (${result.status}): ${result.message}`,
		);
		// 503 from the console means it is misconfigured, not that we sent
		// anything wrong — worth retrying, unlike the rest.
		return NextResponse.json(
			{
				error:
					result.status === 503
						? "The request desk is down — try again shortly."
						: "We couldn't file that just now.",
			},
			{ status: result.status === 503 ? 503 : 502 },
		);
	}

	// No answer. It may well have been filed, so say so rather than inviting a
	// resend that would land as a second copy under a fresh id.
	console.error(`feature request answer unknown: ${result.message}`);
	return NextResponse.json(
		{
			error:
				"It may have gone through — check your email before sending it again.",
		},
		{ status: 504 },
	);
}
