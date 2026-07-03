import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Unlike `next dev`, drizzle-kit only loads `.env` by default — load it
// first, then let `.env.local` override, matching Next's own precedence.
config({ path: ".env" });
config({ path: ".env.local", override: true });

export default defineConfig({
	schema: "./lib/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
});
