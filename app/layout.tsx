import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export const metadata: Metadata = {
	metadataBase: new URL("https://songdraw.fly.dev"),
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
		images: [{ url: "/social-preview.png", width: 1200, height: 630 }],
	},
	twitter: {
		card: "summary_large_image",
		title: "SongDraw",
		description: "Daily whose-song-is-this for a private friend group.",
		images: ["/social-preview.png"],
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
			className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
		>
			<body className="min-h-full flex flex-col">
				{children}
				<Toaster position="top-right" />
			</body>
		</html>
	);
}
