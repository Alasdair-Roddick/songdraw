import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

// Display face for page titles and the hero. Bricolage is variable across
// weight, optical size, width and grade, and its optical corrections read as
// hand-touched rather than drawn on a grid — large headings are genuinely
// different letterforms from body text, the way print type behaves.
//
// It replaces Bebas Neue, which was caps-only, single-weight, and read as
// poster/streetwear rather than analog. Because Bebas had no lowercase, every
// display heading was forced `uppercase`; Bricolage removes that constraint,
// so headings are set in sentence case.
const bricolage = Bricolage_Grotesque({
	variable: "--font-bricolage",
	subsets: ["latin"],
	// Only the display end of the range — body copy stays on Geist.
	weight: ["600", "700", "800"],
});

export const metadata: Metadata = {
	metadataBase: new URL("https://songdraw.party"),
	title: {
		default: "SongDraw",
		template: "%s | SongDraw",
	},
	description: "Daily whose-song-is-this for a private friend group.",
	openGraph: {
		title: "SongDraw",
		description: "Daily whose-song-is-this for a private friend group.",
		siteName: "SongDraw",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		title: "SongDraw",
		description: "Daily whose-song-is-this for a private friend group.",
	},
};

// Tints the browser chrome to match the paper. Without this the warm ground
// meets a pure-white address bar on mobile and reads as a rendering fault
// rather than a colour choice. Values mirror --background in globals.css.
export const viewport: Viewport = {
	colorScheme: "light dark",
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#f6f3ec" },
		{ media: "(prefers-color-scheme: dark)", color: "#150f0c" },
	],
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		// suppressHydrationWarning: next-themes writes the class on <html>
		// before React hydrates, which is the point — it prevents a flash of
		// the wrong palette — but it means server and client markup differ.
		<html
			lang="en"
			suppressHydrationWarning
			className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} h-full antialiased`}
		>
			<body className="min-h-full flex flex-col">
				<Providers>
					{children}
					<Toaster position="top-right" />
				</Providers>
			</body>
		</html>
	);
}
