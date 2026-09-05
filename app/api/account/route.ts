import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { closeAccount } from "@/lib/account";
import { auth } from "@/lib/auth";

/**
 * Closes the caller's own account.
 *
 * Replaces Better Auth's `deleteUser`, which is now disabled in lib/auth.ts —
 * its hard DELETE cascaded into other players' rounds, guesses and rooms. See
 * lib/account.ts for what happens instead.
 */
export async function DELETE(request: Request) {
	const requestHeaders = await headers();
	const session = await auth.api.getSession({ headers: requestHeaders });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const body = await request.json().catch(() => null);
	const password = typeof body?.password === "string" ? body.password : "";
	if (!password) {
		return NextResponse.json(
			{ error: "Enter your password to confirm." },
			{ status: 400 },
		);
	}

	// Re-authenticate. Sessions last ~a year, so a borrowed device must not be
	// able to close an account on its own.
	const verified = await auth.api
		.verifyPassword({ body: { password }, headers: requestHeaders })
		.catch(() => null);
	if (!verified?.status) {
		return NextResponse.json(
			{ error: "That password isn't right." },
			{ status: 403 },
		);
	}

	try {
		await closeAccount(session.user.id);
	} catch (err) {
		console.error(`account closure failed for ${session.user.id}`, err);
		return NextResponse.json(
			{ error: "Couldn't close the account — try again." },
			{ status: 500 },
		);
	}

	// closeAccount deletes every session row, so the caller is already signed
	// out server-side; clearing the cookie just stops the client retrying with a
	// token that no longer resolves.
	const response = NextResponse.json({ ok: true });
	for (const name of [
		"better-auth.session_token",
		"__Secure-better-auth.session_token",
	]) {
		response.cookies.delete(name);
	}
	return response;
}
