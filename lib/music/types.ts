export interface Track {
	provider: string;
	providerTrackId: string;
	title: string;
	artist: string;
	album?: string;
	artworkUrl?: string;
	previewUrl?: string;
}

export interface MusicProvider {
	search(query: string): Promise<Track[]>;
}
