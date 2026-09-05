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
	/** `--brand` — oklch(0.85 0.18 90) */
	brand: "#fbc600",
	/** `--brand-foreground` / `--foreground` — oklch(0.145 0 0) */
	ink: "#0a0a0a",
	/** `--primary`, the brand-mark tile — oklch(0.205 0 0) */
	tile: "#171717",
	/** `--background` */
	paper: "#ffffff",
} as const;
