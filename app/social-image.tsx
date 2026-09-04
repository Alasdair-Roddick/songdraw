import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const socialImageSize = {
	width: 1200,
	height: 630,
};

// Matched to app/globals.css. The tokens there are oklch, which Satori can't
// parse, so they're converted once here rather than eyeballed — an earlier
// guess at the brand yellow drifted to lime and made every link preview look
// like a different product.
const brand = "#fbc600"; // oklch(0.85 0.18 90)
const ink = "#0a0a0a"; // oklch(0.145 0 0)
const paper = "#ffffff";

// iMessage, Slack and Discord all render this a few hundred pixels wide, so it
// is built to survive being shrunk: three type sizes, no body copy, and the
// same hard borders and offset shadows the app uses instead of anything soft.
// @vercel/og only bundles Geist at regular weight, so every `fontWeight: 900`
// below silently rendered as book weight — the exact opposite of the display
// type this brand runs on. Loading the real cuts is the fix. See
// next.config.ts for why these files need an explicit tracing entry.
async function displayFonts() {
	const dir = join(process.cwd(), "app/fonts");
	const [bebas, black, semibold] = await Promise.all([
		readFile(join(dir, "BebasNeue-Regular.ttf")),
		readFile(join(dir, "Geist-Black.ttf")),
		readFile(join(dir, "Geist-SemiBold.ttf")),
	]);
	return [
		// Same split as the app: Bebas for the headline, Geist for everything
		// that has to stay readable small.
		{
			name: "Bebas Neue",
			data: bebas,
			weight: 400 as const,
			style: "normal" as const,
		},
		{
			name: "Geist",
			data: black,
			weight: 900 as const,
			style: "normal" as const,
		},
		{
			name: "Geist",
			data: semibold,
			weight: 600 as const,
			style: "normal" as const,
		},
	];
}

export async function createSocialImage() {
	const fonts = await displayFonts();
	return new ImageResponse(
		<div
			style={{
				background: paper,
				color: ink,
				display: "flex",
				flexDirection: "column",
				height: "100%",
				width: "100%",
			}}
		>
			<div
				style={{
					alignItems: "center",
					borderBottom: `4px solid ${ink}`,
					display: "flex",
					justifyContent: "space-between",
					padding: "28px 56px",
				}}
			>
				<div style={{ alignItems: "center", display: "flex", gap: 16 }}>
					<div
						style={{
							alignItems: "flex-end",
							background: ink,
							display: "flex",
							gap: 5,
							height: 46,
							padding: "0 10px",
							width: 46,
						}}
					>
						{[16, 30, 22].map((height) => (
							<div
								key={height}
								style={{ background: brand, height, width: 6 }}
							/>
						))}
					</div>
					<span
						style={{
							fontFamily: "Geist",
							fontSize: 34,
							fontWeight: 900,
							letterSpacing: "-0.04em",
						}}
					>
						SongDraw
					</span>
				</div>
				<span
					style={{
						fontFamily: "Geist",
						fontSize: 22,
						fontWeight: 600,
						letterSpacing: "0.18em",
					}}
				>
					A DAILY MUSIC GAME
				</span>
			</div>

			<div
				style={{
					alignItems: "center",
					display: "flex",
					flex: 1,
					justifyContent: "space-between",
					padding: "0 56px",
				}}
			>
				<div style={{ display: "flex", flexDirection: "column" }}>
					<span
						style={{
							fontFamily: "Bebas Neue",
							fontSize: 132,
							letterSpacing: "0.02em",
							lineHeight: 0.94,
						}}
					>
						WHOSE
					</span>
					{/* The landing page's signature move: one word knocked out on a
					    tilted brand block. It is what makes the preview recognisable
					    at thumbnail size. */}
					<div
						style={{
							background: brand,
							border: `4px solid ${ink}`,
							display: "flex",
							marginTop: 8,
							padding: "2px 20px 10px 20px",
							transform: "rotate(-1.5deg)",
						}}
					>
						<span
							style={{
								fontFamily: "Bebas Neue",
								fontSize: 132,
								letterSpacing: "0.02em",
								lineHeight: 0.94,
							}}
						>
							SONG
						</span>
					</div>
					<span
						style={{
							fontFamily: "Bebas Neue",
							fontSize: 132,
							letterSpacing: "0.02em",
							lineHeight: 0.94,
							marginTop: 6,
						}}
					>
						IS THIS?
					</span>
				</div>

				<div
					style={{
						background: paper,
						border: `4px solid ${ink}`,
						boxShadow: `14px 14px 0 0 ${ink}`,
						display: "flex",
						flexDirection: "column",
						height: 320,
						justifyContent: "space-between",
						marginRight: 14,
						padding: 26,
						transform: "rotate(3deg)",
						width: 268,
					}}
				>
					<span
						style={{
							fontFamily: "Geist",
							fontSize: 19,
							fontWeight: 600,
							letterSpacing: "0.14em",
						}}
					>
						TODAY&apos;S TRACK
					</span>
					<div
						style={{
							alignItems: "flex-end",
							display: "flex",
							gap: 11,
							height: 136,
						}}
					>
						{[52, 92, 128, 74, 108].map((height, index) => (
							<div
								key={height}
								style={{
									background: index === 2 ? ink : brand,
									border: `3px solid ${ink}`,
									height,
									width: 28,
								}}
							/>
						))}
					</div>
					<span
						style={{
							fontFamily: "Geist",
							fontSize: 19,
							fontWeight: 600,
							letterSpacing: "0.1em",
						}}
					>
						LISTEN → GUESS
					</span>
				</div>
			</div>

			<div
				style={{
					alignItems: "center",
					background: ink,
					color: paper,
					display: "flex",
					justifyContent: "space-between",
					padding: "22px 56px",
				}}
			>
				<span
					style={{
						fontFamily: "Geist",
						fontSize: 24,
						fontWeight: 600,
						letterSpacing: "0.12em",
					}}
				>
					SONGDRAW.PARTY
				</span>
				<span
					style={{
						color: brand,
						fontFamily: "Geist",
						fontSize: 24,
						fontWeight: 600,
						letterSpacing: "0.12em",
					}}
				>
					NEW ROUND AT MIDNIGHT
				</span>
			</div>
		</div>,
		{ ...socialImageSize, fonts },
	);
}
