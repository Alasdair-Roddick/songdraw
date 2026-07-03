import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { itunesProvider } from "@/lib/music/itunes";

export async function GET(req: Request) {
	const requestHeaders = await headers();
	const session = await auth.api.getSession({ headers: requestHeaders });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const url = new URL(req.url);
	const query = url.searchParams.get("query");
	if (!query) {
		return NextResponse.json({ error: "missing query" }, { status: 400 });
	}

	const provider = itunesProvider;
	try {
		const results = await provider.search(query);
		return NextResponse.json(results);
	} catch (error) {
		console.error("Error searching iTunes:", error);
		return NextResponse.json(
			{ error: "failed to search iTunes" },
			{ status: 500 },
		);
	}
}
