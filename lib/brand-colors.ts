/**
 * The brand palette as sRGB hex — the single source of truth for every surface
 * that cannot read a CSS custom property.
 *
 * Two of those exist: `app/social-image.tsx` (Satori can't parse `oklch()`) and
 * `app/icon.svg` (a static file with no way to reference a token). They had
 * already drifted apart — the icon said `#f8d02a` while the OG image said
 * `#fbc600` — so link previews and the favicon were showing different yellows.
 *
 * These are the exact conversions of the `:root` tokens in `app/globals.css`.
 * Change them there first, then mirror here; `bun run test` checks they agree.
 */
export const BRAND_HEX = {
	/** `--brand` — oklch(0.76 0.135 68), the burnt amber */
	brand: "#e99f47",
	/** `--foreground` — oklch(0.235 0.015 55), warm near-black */
	ink: "#241c17",
	/** `--primary`, the brand-mark tile — oklch(0.28 0.02 55) */
	tile: "#312620",
	/** `--background` — oklch(0.965 0.01 85), warm chalky paper */
	paper: "#f6f3ec",
} as const;
