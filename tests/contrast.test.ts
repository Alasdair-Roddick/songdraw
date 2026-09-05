import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

/**
 * Contrast guards for the palette in app/globals.css.
 *
 * The analog restyle traded a maximum-contrast brutalist palette for a muted
 * warm one, which is exactly the change that quietly breaks accessibility. The
 * old palette had already shipped one failure nobody caught: the focus ring was
 * the brand yellow at 1.6:1 on white, well under the 3:1 minimum.
 *
 * These parse the real stylesheet, so they fail if someone retunes a colour by
 * eye and drifts below the line.
 */

const css = readFileSync(
	join(import.meta.dirname, "..", "app", "globals.css"),
	"utf8",
);

/** Pull a token's oklch triple out of a given block (`:root` or `.dark`). */
function token(block: string, name: string): [number, number, number] {
	const start = css.indexOf(`${block} {`);
	assert.notEqual(start, -1, `block ${block} not found`);
	const body = css.slice(start, css.indexOf("\n}", start));
	const m = body.match(
		new RegExp(`--${name}:\\s*oklch\\(([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)\\)`),
	);
	assert.ok(m, `--${name} not found in ${block}`);
	return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function toRgb([L, C, H]: [number, number, number]) {
	const h = (H * Math.PI) / 180;
	const a = C * Math.cos(h);
	const b = C * Math.sin(h);
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	].map((v) => Math.min(1, Math.max(0, v)));
}

function luminance(rgb: number[]) {
	const [r, g, b] = rgb
		.map((v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055))
		.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(block: string, a: string, b: string) {
	const la = luminance(toRgb(token(block, a)));
	const lb = luminance(toRgb(token(block, b)));
	return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const cases: [string, string, string, string, number][] = [
	// block, foreground, background, label, minimum
	[":root", "foreground", "background", "body text on paper", 4.5],
	[":root", "muted-foreground", "background", "muted text on paper", 4.5],
	[":root", "brand-foreground", "brand", "CTA label on brand", 4.5],
	// WCAG 1.4.11: 3:1 for boundaries that identify a control, and for focus.
	[":root", "ring", "background", "focus ring on paper", 3],
	[":root", "rule-strong", "background", "control border on paper", 3],
	[".dark", "foreground", "background", "body text in darkroom", 4.5],
	[".dark", "muted-foreground", "background", "muted text in darkroom", 4.5],
	[".dark", "brand", "background", "safelight on darkroom", 4.5],
	[".dark", "ring", "background", "focus ring in darkroom", 3],
	[".dark", "rule-strong", "background", "control border in darkroom", 3],
];

for (const [block, fg, bg, label, min] of cases) {
	test(`${label} meets ${min}:1`, () => {
		const r = ratio(block, fg, bg);
		assert.ok(
			r >= min,
			`${label}: ${r.toFixed(2)}:1 (--${fg} on --${bg} in ${block}) — needs ${min}:1`,
		);
	});
}

// --rule is deliberately below 3:1: it draws decorative dividers, which WCAG
// imposes no minimum on. This asserts the *split* still exists, so a future
// edit can't collapse the two tokens back into one and silently take control
// borders down with it.
test("the decorative rule stays distinct from the control rule", () => {
	assert.notDeepEqual(
		token(":root", "rule"),
		token(":root", "rule-strong"),
		"--rule and --rule-strong must not collapse: control borders need 3:1",
	);
});
