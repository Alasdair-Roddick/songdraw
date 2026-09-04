import { deezerProvider } from "./deezer";
import { itunesProvider } from "./itunes";
import type { Track } from "./types";

const PROVIDERS = {
	itunes: itunesProvider,
	deezer: deezerProvider,
} as const;

export type ProviderName = keyof typeof PROVIDERS;

const DEFAULT_PROVIDER: ProviderName = "itunes";

/** `MUSIC_PROVIDER=deezer` swaps the primary with no code change (M2-2). */
export function primaryProvider(): ProviderName {
	const configured = process.env.MUSIC_PROVIDER?.trim().toLowerCase();
	return configured === "itunes" || configured === "deezer"
		? configured
		: DEFAULT_PROVIDER;
}

/**
 * Searches the configured provider, falling back to the other one when it
 * fails *or* comes back empty.
 *
 * Empty counts as a miss on purpose: the risk this closes (GamePlan §8) is
 * patchy catalogue and preview coverage, and a track one service has never
 * heard of is exactly when the other earns its keep. Both are keyless and
 * uncapped, so the extra call costs nothing but latency on a rare path.
 */
export async function searchTracks(
	query: string,
): Promise<{ tracks: Track[]; provider: ProviderName }> {
	const primary = primaryProvider();
	const order: ProviderName[] = [
		primary,
		...(Object.keys(PROVIDERS) as ProviderName[]).filter(
			(name) => name !== primary,
		),
	];

	let lastError: unknown = null;

	for (const name of order) {
		try {
			const tracks = await PROVIDERS[name].search(query);
			if (tracks.length > 0) return { tracks, provider: name };
		} catch (error) {
			lastError = error;
			console.error(`music search via ${name} failed`, error);
		}
	}

	// Every provider errored — the caller should 500 rather than present an
	// empty result set as "no matches".
	if (lastError) throw lastError;

	// Everyone answered, nobody had it. That is a real empty result.
	return { tracks: [], provider: primary };
}
