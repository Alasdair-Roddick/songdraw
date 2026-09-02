import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./schema";
import { trackAsset } from "./track-asset";

/**
 * One song bank per person, shared across every game they're in.
 *
 * A song is consumed the first time any game draws it: the row flips to
 * `played` and drops out of both the bank and every future draw. The row itself
 * stays, because its round still points at it — "removed from the bank" is a
 * status, not a delete.
 *
 * There is deliberately no unique (user, track): the same track may come back
 * to a bank once REPLAY_AFTER_ROUNDS have passed, so a person can hold several
 * rows for one track across time. The live-duplicate rule is enforced in the
 * bank route instead, where the cooldown lives too.
 */
export const bankSong = pgTable(
	"bank_song",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		trackId: text("track_id")
			.notNull()
			.references(() => trackAsset.id, { onDelete: "restrict" }),
		// "banked" | "played"
		status: text("status").notNull().default("banked"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("bank_song_user_status_idx").on(table.userId, table.status),
		index("bank_song_track_idx").on(table.trackId),
	],
);

export const bankSongRelations = relations(bankSong, ({ one }) => ({
	owner: one(user, { fields: [bankSong.userId], references: [user.id] }),
	track: one(trackAsset, {
		fields: [bankSong.trackId],
		references: [trackAsset.id],
	}),
}));
