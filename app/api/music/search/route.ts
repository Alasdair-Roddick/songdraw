import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchTracks } from "@/lib/music/provider";

export async function GET(req: Request) {
	const requestHeaders = await headers();
	const session = await auth.api.getSession({ headers: requestHeaders });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const url = new URL(req.url);
	const query = url.searchParams.get("query")?.trim();
	if (!query || query.length < 2) {
		return NextResponse.json({ error: "missing query" }, { status: 400 });
	}
	if (query.length > 120) {
		return NextResponse.json({ error: "query is too long" }, { status: 400 });
	}

	try {
		// Provider choice and fallback live in lib/music/provider.ts, so this
		// route stays the same whichever service actually answers.
		const { tracks } = await searchTracks(query);
		return NextResponse.json(tracks);
	} catch (error) {
		console.error("music search failed on every provider", error);
		return NextResponse.json({ error: "failed to search" }, { status: 500 });
	}
}
