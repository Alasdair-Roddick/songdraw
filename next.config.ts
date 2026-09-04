import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	output: "standalone",
	// The OG/Twitter images read their font files from disk at request time, so
	// nothing in the bundle references them and the standalone tracer would
	// otherwise leave them out — the image renders, but silently falls back to
	// @vercel/og's regular-weight Geist.
	outputFileTracingIncludes: {
		"/opengraph-image": ["./app/fonts/**"],
		"/twitter-image": ["./app/fonts/**"],
	},
};

export default nextConfig;
