import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const AUTH_PAGES = ["/login", "/signup"];
const SESSION_COOKIES = [
	"better-auth.session_token",
	"__Secure-better-auth.session_token",
];

export async function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// A real DB-backed check, not just "is a session cookie present" — a
	// stale cookie (session deleted, DB reset, etc.) would otherwise disagree
	// with the page-level check in /home and loop forever between
	// /home <-> /login.
	const session = await auth.api.getSession({ headers: request.headers });

	if (pathname.startsWith("/home") && !session) {
		const response = NextResponse.redirect(new URL("/login", request.url));
		for (const name of SESSION_COOKIES) response.cookies.delete(name);
		return response;
	}

	if (AUTH_PAGES.includes(pathname) && session) {
		return NextResponse.redirect(new URL("/home", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/home/:path*", "/login", "/signup"],
};
