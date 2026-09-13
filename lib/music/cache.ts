import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { trackAsset } from "@/lib/db/track-asset";
import type { Track } from "@/lib/music/types";

// Artwork and preview URLs from here are rendered as <img src> and fed to an
// <audio> element, and they arrive from the browser rather than from the
// provider directly (the client posts back whichever search result it picked).
// Pinning the hosts means a hand-crafted request can't park an arbitrary URL in
// a row every member of a room will load.
//
// Verified against live responses: iTunes serves artwork from is*-ssl.mzstatic
// .com and previews from audio-ssl.itunes.apple.com; Deezer uses dzcdn.net for
// both.
const ALLOWED_ASSET_HOSTS = [
	".mzstatic.com",
	".itunes.apple.com",
	".dzcdn.net",
];

export function isAllowedAssetUrl(value: string | undefined) {
	if (!value) return true; // absent is fine — plenty of tracks have no preview
	try {
		const url = new URL(value);
		if (url.protocol !== "https:") return false;
		return ALLOWED_ASSET_HOSTS.some(
			(host) => url.hostname === host.slice(1) || url.hostname.endsWith(host),
		);
	} catch {
		return false;
	}
}

/**
 * Caches a track the first time anyone picks it, and returns the cached row
 * thereafter.
 *
 * Insert-only by design. This used to `onConflictDoUpdate` every field, which
 * meant any logged-in user could rewrite the title, artist, artwork and preview
 * of a track already cached — including one sitting in someone else's bank or in
 * a played round's history. Nothing here is user-authored, so the first write
 * wins and later ones are a no-op.
 */
export async function upsertTrackAsset(track: Track) {
	const releaseYear = track.releaseDate
		? new Date(track.releaseDate).getUTCFullYear()
		: null;

	const [inserted] = await db
		.insert(trackAsset)
		.values({
			provider: track.provider,
			providerTrackId: track.providerTrackId,
			title: track.title,
			artist: track.artist,
			album: track.album,
			artworkUrl: track.artworkUrl,
			previewUrl: track.previewUrl,
			releaseYear: Number.isFinite(releaseYear) ? releaseYear : null,
		})
		.onConflictDoNothing({
			target: [trackAsset.provider, trackAsset.providerTrackId],
		})
		.returning();

	if (inserted) return inserted;

	// Already cached: hand back what's stored rather than what was sent.
	const [existing] = await db
		.select()
		.from(trackAsset)
		.where(
			and(
				eq(trackAsset.provider, track.provider),
				eq(trackAsset.providerTrackId, track.providerTrackId),
			),
		)
		.limit(1);

	return existing;
}
