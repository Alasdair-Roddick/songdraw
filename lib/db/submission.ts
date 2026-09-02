import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { game, gameMember } from "./game";
import { trackAsset } from "./track-asset";

// A song banked into a game's pool. Lifecycle per GamePlan §2:
// pooled → played → retired. Played songs never come back; a leaving member's
// pool retires with them.
export const submission = pgTable(
	"submission",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		gameId: text("game_id")
			.notNull()
			.references(() => game.id, { onDelete: "cascade" }),
		memberId: text("member_id")
			.notNull()
			.references(() => gameMember.id, { onDelete: "cascade" }),
		trackId: text("track_id")
			.notNull()
			.references(() => trackAsset.id, { onDelete: "restrict" }),
		// "pooled" | "played" | "retired"
		status: text("status").notNull().default("pooled"),
		// Set when the draw picks this song. No FK yet — the round table lands
		// with the draw job in M4.
		playedInRoundId: text("played_in_round_id"),
		submittedAt: timestamp("submitted_at").defaultNow().notNull(),
	},
	(table) => [
		// Scoped to the member, not the game: two people secretly banking the
		// same track is allowed (and funny when it's drawn), because nobody has
		// seen an unplayed song. Stopping *yourself* double-banking is the part
		// that matters — that's a wasted slot. See docs/pooling.md.
		unique().on(table.gameId, table.memberId, table.trackId),
		index("submission_game_status_idx").on(table.gameId, table.status),
		index("submission_member_status_idx").on(table.memberId, table.status),
	],
);

export const submissionRelations = relations(submission, ({ one }) => ({
	game: one(game, { fields: [submission.gameId], references: [game.id] }),
	member: one(gameMember, {
		fields: [submission.memberId],
		references: [gameMember.id],
	}),
	track: one(trackAsset, {
		fields: [submission.trackId],
		references: [trackAsset.id],
	}),
}));
