import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { and, ne, sql } from "drizzle-orm";
import { db } from "./db";
import { user } from "./db/schema";
import { sendPasswordResetEmail } from "./email";
import { usernameError } from "./username";

// Names are compared case-insensitively against the `user_name_lower_unique`
// index in lib/db/schema.ts. Checking here first turns what would be a raw
// constraint violation (a 500) into a message both the signup page and the
// settings dialog already render from `error.message`.
async function assertNameAvailable(name: string, exceptUserId?: string) {
	const matchesName = sql`lower(${user.name}) = lower(${name})`;
	const taken = await db
		.select({ id: user.id })
		.from(user)
		.where(
			exceptUserId ? and(matchesName, ne(user.id, exceptUserId)) : matchesName,
		)
		.limit(1);

	if (taken.length > 0) {
		throw new APIError("UNPROCESSABLE_ENTITY", {
			message: `"${name}" is taken — pick another name.`,
		});
	}
}

// Reject rather than silently edit a player's chosen username. The same rule
// powers the signup/settings hint, and also covers direct API requests.
function normaliseName(value: unknown) {
	if (value === undefined) return null;
	if (typeof value !== "string") {
		throw new APIError("BAD_REQUEST", { message: "Pick a username." });
	}
	const error = usernameError(value);
	if (error) throw new APIError("BAD_REQUEST", { message: error });
	return value;
}

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "pg",
	}),
	emailAndPassword: {
		enabled: true,
		// GamePlan.md §3 deferred this until it became a real pain point — it
		// has. Sessions are still ~1 year, so this is the rare path, not the
		// daily one. Better Auth mints and expires the token itself; all we own
		// is delivery. Errors thrown in here surface to the caller, so a broken
		// Resend key fails loudly instead of pointing at an empty inbox.
		sendResetPassword: async ({ user: recipient, url }) => {
			await sendPasswordResetEmail({
				name: recipient.name,
				email: recipient.email,
				url,
			});
		},
	},
	user: {
		// No SMTP, so email changes apply immediately rather than going
		// through a verification link — same reasoning as the rest of auth.
		changeEmail: {
			enabled: true,
			updateEmailWithoutVerification: true,
		},
		// Deliberately disabled. Better Auth's deleteUser issues a hard DELETE on
		// the user row, and the cascades run
		//   user → game (owner_id) → every member, round, guess and invite
		//   user → bank_song → round → guess
		// so one person closing their account would erase rounds other people
		// played and rooms other people were in, leaving their stat_snapshot
		// counters pointing at rows that no longer exist.
		//
		// DELETE /api/account does it properly — see lib/account.ts.
		deleteUser: {
			enabled: false,
		},
	},
	session: {
		// ~1 year, refreshed whenever the cookie is re-validated within a day of
		// last use — GamePlan.md decision #2: streak durability over expiry.
		expiresIn: 60 * 60 * 24 * 365,
		updateAge: 60 * 60 * 24,
	},
	// One enforcement point for every path that writes a name — signup, the
	// settings dialog, and anything added later — rather than a check per
	// caller. The avatar routes call updateUser with `image` only, so the
	// update hook has to no-op when `name` isn't part of the patch.
	databaseHooks: {
		user: {
			create: {
				before: async (data) => {
					const name = normaliseName(data.name);
					if (name === null) return;
					await assertNameAvailable(name);
					return { data: { ...data, name } };
				},
			},
			update: {
				before: async (data, context) => {
					const name = normaliseName(data.name);
					if (name === null) return;
					// Excluding yourself lets you re-case your own name
					// ("alex" -> "Alex") without colliding with your own row.
					await assertNameAvailable(name, context?.context.session?.user.id);
					return { data: { ...data, name } };
				},
			},
		},
	},
});
