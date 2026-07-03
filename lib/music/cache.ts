import { db } from "@/lib/db";
import { trackAsset } from "@/lib/db/track-asset";
import type { Track } from "@/lib/music/types";

export async function upsertTrackAsset(track: Track) {
	const [row] = await db
		.insert(trackAsset)
		.values({
			provider: track.provider,
			providerTrackId: track.providerTrackId,
			title: track.title,
			artist: track.artist,
			album: track.album,
			artworkUrl: track.artworkUrl,
			previewUrl: track.previewUrl,
		})
		.onConflictDoUpdate({
			target: [trackAsset.provider, trackAsset.providerTrackId],
			set: {
				title: track.title,
				artist: track.artist,
				album: track.album,
				artworkUrl: track.artworkUrl,
				previewUrl: track.previewUrl,
			},
		})
		.returning();

	return row;
}
