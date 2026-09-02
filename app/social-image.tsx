import { ImageResponse } from "next/og";

export const socialImageSize = {
	width: 1200,
	height: 630,
};

const brand = "#e7ff52";
const ink = "#171717";
const muted = "#737373";
const line = "#e8e8e8";

export function createSocialImage() {
	return new ImageResponse(
		<div
			style={{
				background: "#ffffff",
				color: ink,
				display: "flex",
				height: "100%",
				width: "100%",
				padding: "64px 72px",
				position: "relative",
			}}
		>
			<div
				style={{
					border: `2px solid ${ink}`,
					borderRadius: 999,
					display: "flex",
					fontFamily: "Geist",
					fontSize: 22,
					fontWeight: 600,
					height: 44,
					letterSpacing: "0.04em",
					padding: "8px 18px",
					position: "absolute",
					right: 72,
					top: 58,
				}}
			>
				A DAILY MUSIC GAME
			</div>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					width: "59%",
				}}
			>
				<div
					style={{
						alignItems: "center",
						display: "flex",
						fontFamily: "Geist",
						fontSize: 72,
						fontWeight: 700,
						letterSpacing: "-0.07em",
						lineHeight: 1,
					}}
				>
					<span>SongDraw</span>
					<span
						style={{
							background: brand,
							border: `3px solid ${ink}`,
							borderRadius: 999,
							height: 24,
							marginLeft: 22,
							width: 24,
						}}
					/>
				</div>
				<div
					style={{
						fontFamily: "Geist",
						fontSize: 32,
						fontWeight: 400,
						letterSpacing: "-0.025em",
						lineHeight: 1.25,
						marginTop: 28,
						maxWidth: 570,
					}}
				>
					Whose song is this?
				</div>
				<div
					style={{
						color: muted,
						display: "flex",
						fontFamily: "Geist",
						fontSize: 21,
						letterSpacing: "-0.01em",
						marginTop: 14,
					}}
				>
					Pick a friend. Lock in your guess. Keep the songs coming.
				</div>
			</div>

			<div
				style={{
					alignItems: "center",
					display: "flex",
					justifyContent: "center",
					width: "41%",
				}}
			>
				<div
					style={{
						background: ink,
						borderRadius: 36,
						display: "flex",
						height: 370,
						padding: 26,
						transform: "rotate(7deg)",
						width: 300,
					}}
				>
					<div
						style={{
							background: brand,
							borderRadius: 20,
							display: "flex",
							flexDirection: "column",
							justifyContent: "space-between",
							padding: 24,
							width: "100%",
						}}
					>
						<div
							style={{
								display: "flex",
								fontFamily: "Geist",
								fontSize: 20,
								fontWeight: 700,
							}}
						>
							TODAY&apos;S TRACK
						</div>
						<div
							style={{
								alignItems: "flex-end",
								display: "flex",
								gap: 10,
								height: 130,
							}}
						>
							{[48, 86, 116, 72, 104].map((height, index) => (
								<div
									key={height}
									style={{
										background: index === 2 ? ink : "#ffffff",
										borderRadius: 999,
										height,
										width: 25,
									}}
								/>
							))}
						</div>
						<div
							style={{
								display: "flex",
								fontFamily: "Geist",
								fontSize: 17,
								fontWeight: 600,
							}}
						>
							LISTEN. GUESS. REVEAL.
						</div>
					</div>
				</div>
			</div>

			<div
				style={{
					background: line,
					bottom: 64,
					height: 2,
					left: 72,
					position: "absolute",
					width: 1056,
				}}
			/>
		</div>,
		socialImageSize,
	);
}
