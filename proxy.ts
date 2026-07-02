import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const AUTH_PAGES = ["/login", "/signup"];

export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const hasSession = Boolean(getSessionCookie(request));

	if (pathname.startsWith("/home") && !hasSession) {
		return NextResponse.redirect(new URL("/login", request.url));
	}

	if (AUTH_PAGES.includes(pathname) && hasSession) {
		return NextResponse.redirect(new URL("/home", request.url));
	}

	return NextResponse.next();
}

export const config = {
	matcher: ["/home/:path*", "/login", "/signup"],
};
