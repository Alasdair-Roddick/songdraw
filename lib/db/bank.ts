import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { user } from "./schema";
import { trackAsset } from "./track-asset";

/**
 * One song bank per person, shared across every game they're in.
 *
 * There is deliberately no per-game status here. "Already played" is a fact
 * about a *game*, not about the song — a track Game A has used is still fresh
 * to Game B, whose members never heard it. So the draw derives that by looking
 * at which bank songs a given game's rounds have already consumed, and this
 * table stays a plain list of what you're holding.
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
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		// You can't hold the same track twice; two different people can.
		unique().on(table.userId, table.trackId),
		index("bank_song_user_idx").on(table.userId),
	],
);

export const bankSongRelations = relations(bankSong, ({ one }) => ({
	owner: one(user, { fields: [bankSong.userId], references: [user.id] }),
	track: one(trackAsset, {
		fields: [bankSong.trackId],
		references: [trackAsset.id],
	}),
}));
