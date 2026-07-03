import type { MusicProvider, Track } from "./types";

interface ITunesResult {
	trackId: number;
	trackName: string;
	artistName: string;
	collectionName?: string;
	artworkUrl100?: string;
	previewUrl?: string;
}

export class ITunesProvider implements MusicProvider {
	async search(query: string): Promise<Track[]> {
		const url = new URL("https://itunes.apple.com/search");
		url.searchParams.set("term", query);
		url.searchParams.set("media", "music");
		url.searchParams.set("limit", "10");

		const response = await fetch(url.toString(), {
			signal: AbortSignal.timeout(5000),
		});
		if (!response.ok) {
			throw new Error(
				`iTunes API request failed with status ${response.status}`,
			);
		}

		const data: { results: ITunesResult[] } = await response.json();
		return data.results.map((item) => ({
			provider: "itunes",
			providerTrackId: item.trackId.toString(),
			title: item.trackName,
			artist: item.artistName,
			album: item.collectionName,
			artworkUrl: item.artworkUrl100?.replace("100x100", "600x600"),
			previewUrl: item.previewUrl,
		}));
	}
}

export const itunesProvider: MusicProvider = new ITunesProvider();
