import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { BRAND_HEX } from "../lib/brand-colors";

/**
 * The favicon and the OG image can't read a CSS token, so they carry hex copies
 * of the palette. They had already drifted apart unnoticed — the icon rendered
 * #f8d02a while link previews rendered #fbc600 — because nothing compared them.
 */

const root = join(import.meta.dirname, "..");
// Only the fill attributes; the file also names the old values in a comment
// explaining the drift, and those must not count as a match.
const iconFills = new Set(
	[
		...readFileSync(join(root, "app/icon.svg"), "utf8").matchAll(
			/fill="(#[0-9a-fA-F]{3,6})"/g,
		),
	].map((m) => m[1].toLowerCase()),
);

test("the favicon uses the brand yellow, not a near-miss", () => {
	assert.ok(
		iconFills.has(BRAND_HEX.brand),
		`app/icon.svg fills ${[...iconFills].join(", ")} — expected ${BRAND_HEX.brand}`,
	);
});

test("the favicon tile uses the brand-mark colour", () => {
	assert.ok(
		iconFills.has(BRAND_HEX.tile),
		`app/icon.svg fills ${[...iconFills].join(", ")} — expected ${BRAND_HEX.tile}`,
	);
});

test("the social image reads the shared palette rather than its own literals", () => {
	const source = readFileSync(join(root, "app/social-image.tsx"), "utf8");
	assert.match(
		source,
		/BRAND_HEX/,
		"app/social-image.tsx should import BRAND_HEX",
	);
	// Guard against someone reintroducing a local copy of the palette.
	const literals = source.match(/^const (brand|ink|paper) = "#/gm);
	assert.equal(literals, null, "social-image.tsx redeclares a colour literal");
});
