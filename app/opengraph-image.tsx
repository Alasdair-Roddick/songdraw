import { ImageResponse } from "next/og";

export const alt =
	"SongDraw — daily whose-song-is-this for a private friend group";

export const size = {
	width: 1200,
	height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
	return new ImageResponse(
		<div
			style={{
				alignItems: "center",
				backgroundColor: "#ffffff",
				display: "flex",
				height: "100%",
				justifyContent: "space-between",
				padding: "72px",
				width: "100%",
			}}
		>
			<div style={{ display: "flex", flexDirection: "column", gap: "26px" }}>
				<div
					style={{
						color: "#5c5c5c",
						display: "flex",
						fontFamily: "monospace",
						fontSize: 26,
						fontWeight: 700,
						letterSpacing: "0.12em",
						textTransform: "uppercase",
					}}
				>
					DAILY MUSIC GAME
				</div>
				<div
					style={{
						color: "#252525",
						display: "flex",
						fontFamily: "sans-serif",
						fontSize: 106,
						fontWeight: 900,
						letterSpacing: "-0.08em",
						lineHeight: 0.92,
					}}
				>
					SONG
				</div>
				<div
					style={{
						alignItems: "center",
						backgroundColor: "#f8d02a",
						color: "#252525",
						display: "flex",
						fontFamily: "sans-serif",
						fontSize: 106,
						fontWeight: 900,
						letterSpacing: "-0.08em",
						lineHeight: 0.92,
						padding: "16px 24px",
						transform: "rotate(-2deg)",
						width: 330,
					}}
				>
					DRAW
				</div>
			</div>
			<div
				style={{
					alignItems: "center",
					backgroundColor: "#252525",
					border: "16px solid #252525",
					display: "flex",
					height: 360,
					justifyContent: "center",
					width: 360,
				}}
			>
				<div
					style={{
						alignItems: "flex-end",
						border: "16px solid #f8d02a",
						display: "flex",
						gap: 22,
						height: "100%",
						justifyContent: "center",
						padding: "55px",
						width: "100%",
					}}
				>
					<div
						style={{
							backgroundColor: "#fff",
							borderRadius: 18,
							height: 126,
							width: 36,
						}}
					/>
					<div
						style={{
							backgroundColor: "#fff",
							borderRadius: 18,
							height: 194,
							width: 36,
						}}
					/>
					<div
						style={{
							backgroundColor: "#fff",
							borderRadius: 18,
							height: 158,
							width: 36,
						}}
					/>
					<div
						style={{
							backgroundColor: "#fff",
							borderRadius: 18,
							height: 226,
							width: 36,
						}}
					/>
				</div>
			</div>
		</div>,
		{ ...size },
	);
}
