import type { Metadata } from "next";
import { Bebas_Neue, Geist, Geist_Mono } from "next/font/google";
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

// Display face for page titles and the hero only — never body or UI copy.
// Bebas ships a single 400 weight and has no lowercase, so `font-black` and
// `uppercase` are no-ops on it; the weight now comes from the letterforms
// rather than from a Tailwind class.
const bebas = Bebas_Neue({
	variable: "--font-bebas",
	weight: "400",
	subsets: ["latin"],
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

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			className={`${geistSans.variable} ${geistMono.variable} ${bebas.variable} h-full antialiased`}
		>
			<body className="min-h-full flex flex-col">
				{children}
				<Toaster position="top-right" />
			</body>
		</html>
	);
}
