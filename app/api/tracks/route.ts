import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { upsertTrackAsset } from "@/lib/music/cache";
import type { Track } from "@/lib/music/types";

export async function POST(request: Request) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const track: Track = await request.json();
	if (
		!track?.provider ||
		!track?.providerTrackId ||
		!track?.title ||
		!track?.artist
	) {
		return NextResponse.json({ error: "invalid track" }, { status: 400 });
	}

	const row = await upsertTrackAsset(track);
	return NextResponse.json(row);
}
