import type { MusicProvider, Track } from "./types";

interface DeezerResult {
	id: number;
	title: string;
	preview?: string;
	artist?: { name?: string };
	album?: { title?: string; cover_xl?: string; cover_big?: string };
}

// Exported for the unit test — the mapping is the only part worth pinning down,
// since the network shape is what breaks silently when Deezer changes it.
export function normaliseDeezerTrack(item: DeezerResult): Track | null {
	// Deezer occasionally returns entries with no artist block at all. A track
	// with no attributable artist is unusable in a guessing game, so drop it
	// rather than surfacing "undefined" in the picker.
	const artist = item.artist?.name;
	if (!artist || !item.title) return null;

	return {
		provider: "deezer",
		providerTrackId: item.id.toString(),
		title: item.title,
		artist,
		album: item.album?.title,
		// cover_xl is 1000x1000, matching the size the iTunes provider asks for.
		artworkUrl: item.album?.cover_xl ?? item.album?.cover_big,
		// Deezer sends "" rather than omitting the field when there is no
		// preview; an empty string would defeat the `previewUrl ? …` checks the
		// play UI does, so normalise it away.
		previewUrl: item.preview || undefined,
	};
}

export class DeezerProvider implements MusicProvider {
	async search(query: string): Promise<Track[]> {
		const url = new URL("https://api.deezer.com/search");
		url.searchParams.set("q", query);
		url.searchParams.set("limit", "25");

		const response = await fetch(url.toString(), {
			signal: AbortSignal.timeout(5000),
		});
		if (!response.ok) {
			throw new Error(
				`Deezer API request failed with status ${response.status}`,
			);
		}

		const data: { data?: DeezerResult[] } = await response.json();
		return (data.data ?? [])
			.map(normaliseDeezerTrack)
			.filter((track): track is Track => track !== null);
	}
}

export const deezerProvider: MusicProvider = new DeezerProvider();
