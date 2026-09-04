import assert from "node:assert/strict";
import test from "node:test";
import { normaliseDeezerTrack } from "../lib/music/deezer";
import { primaryProvider } from "../lib/music/provider";

const base = {
	id: 883427,
	title: "This Boy's In Love",
	preview: "https://cdnt-preview.dzcdn.net/api/1/1/0/6/0/0/060.mp3",
	artist: { name: "The Presets" },
	album: { title: "Apocalypso", cover_xl: "https://cdn/1000.jpg" },
};

test("deezer results normalise onto the internal Track shape", () => {
	assert.deepEqual(normaliseDeezerTrack(base), {
		provider: "deezer",
		providerTrackId: "883427",
		title: "This Boy's In Love",
		artist: "The Presets",
		album: "Apocalypso",
		artworkUrl: "https://cdn/1000.jpg",
		previewUrl: "https://cdnt-preview.dzcdn.net/api/1/1/0/6/0/0/060.mp3",
	});
});

test("an entry with no attributable artist is dropped, not surfaced", () => {
	assert.equal(normaliseDeezerTrack({ ...base, artist: undefined }), null);
	assert.equal(normaliseDeezerTrack({ ...base, artist: {} }), null);
	assert.equal(normaliseDeezerTrack({ ...base, title: "" }), null);
});

test("deezer's empty-string preview becomes undefined", () => {
	// "" would pass a `previewUrl ? …` guard and hand the player a dead src.
	assert.equal(
		normaliseDeezerTrack({ ...base, preview: "" })?.previewUrl,
		undefined,
	);
});

test("artwork falls back to cover_big when cover_xl is absent", () => {
	const track = normaliseDeezerTrack({
		...base,
		album: { title: "Apocalypso", cover_big: "https://cdn/500.jpg" },
	});
	assert.equal(track?.artworkUrl, "https://cdn/500.jpg");
});

test("MUSIC_PROVIDER selects the primary and ignores anything unknown", () => {
	const original = process.env.MUSIC_PROVIDER;
	try {
		process.env.MUSIC_PROVIDER = "deezer";
		assert.equal(primaryProvider(), "deezer");

		process.env.MUSIC_PROVIDER = "  ITUNES  ";
		assert.equal(primaryProvider(), "itunes");

		// A typo must not leave the app with no provider at all.
		process.env.MUSIC_PROVIDER = "spotify";
		assert.equal(primaryProvider(), "itunes");

		process.env.MUSIC_PROVIDER = undefined;
		assert.equal(primaryProvider(), "itunes");
	} finally {
		if (original === undefined) delete process.env.MUSIC_PROVIDER;
		else process.env.MUSIC_PROVIDER = original;
	}
});
