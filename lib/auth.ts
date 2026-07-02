import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	emailAndPassword: {
		enabled: true,
	},
	user: {
		// No SMTP, so email changes apply immediately rather than going
		// through a verification link — same reasoning as the rest of auth.
		changeEmail: {
			enabled: true,
			updateEmailWithoutVerification: true,
		},
		deleteUser: {
			enabled: true,
		},
	},
	session: {
		// ~1 year, refreshed whenever the cookie is re-validated within a day of
		// last use — GamePlan.md decision #2: streak durability over expiry.
		expiresIn: 60 * 60 * 24 * 365,
		updateAge: 60 * 60 * 24,
	},
});
