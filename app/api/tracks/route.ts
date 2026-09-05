import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAllowedAssetUrl, upsertTrackAsset } from "@/lib/music/cache";
import type { Track } from "@/lib/music/types";

export async function POST(request: Request) {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	// Malformed JSON reached `await request.json()` unguarded and surfaced as an
	// unhandled 500; a bad body is a client error.
	const track: Track | null = await request.json().catch(() => null);
	if (
		!track?.provider ||
		!track?.providerTrackId ||
		!track?.title ||
		!track?.artist
	) {
		return NextResponse.json({ error: "invalid track" }, { status: 400 });
	}

	if (
		!isAllowedAssetUrl(track.artworkUrl) ||
		!isAllowedAssetUrl(track.previewUrl)
	) {
		return NextResponse.json(
			{ error: "artwork and preview must come from the music provider" },
			{ status: 400 },
		);
	}

	const row = await upsertTrackAsset(track);
	return NextResponse.json(row);
}
