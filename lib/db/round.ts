import { relations } from "drizzle-orm";
import {
	boolean,
	date,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import { bankSong } from "./bank";
import { game, gameMember } from "./game";
import { user } from "./schema";

// One drawn song per game per day. `bankSongId` is the answer and must never
// reach a guesser before the reveal unlocks — see lib/round.ts.
export const round = pgTable(
	"round",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		gameId: text("game_id")
			.notNull()
			.references(() => game.id, { onDelete: "cascade" }),
		// Date in Australia/Adelaide, not UTC. Stored as a plain YYYY-MM-DD so
		// "which day is this" can never drift with the server's timezone.
		roundDate: date("round_date", { mode: "string" }).notNull(),
		// Which of someone's banked songs is up today. The submitter is derived
		// from bank_song.user_id, joined back to this game's members.
		bankSongId: text("bank_song_id")
			.notNull()
			.references(() => bankSong.id, { onDelete: "cascade" }),
		// "open" | "closed"
		status: text("status").notNull().default("open"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		// The idempotency guarantee for the draw job: a double-fired cron can
		// only ever produce one round per game per day.
		unique().on(table.gameId, table.roundDate),
		index("round_game_status_idx").on(table.gameId, table.status),
	],
);

export const guess = pgTable(
	"guess",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		roundId: text("round_id")
			.notNull()
			.references(() => round.id, { onDelete: "cascade" }),
		guesserUserId: text("guesser_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		guessedMemberId: text("guessed_member_id")
			.notNull()
			.references(() => gameMember.id, { onDelete: "cascade" }),
		isCorrect: boolean("is_correct").notNull(),
		points: integer("points").notNull().default(0),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	// One guess per person per round — GamePlan §2, single attempt.
	(table) => [unique().on(table.roundId, table.guesserUserId)],
);

// Denormalised per (game, user) so leaderboards are a single cheap read.
// Every field here is derivable from `guess` + `round`; this is a cache, and
// docs/runbook.md covers recomputing it.
export const statSnapshot = pgTable(
	"stat_snapshot",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		gameId: text("game_id")
			.notNull()
			.references(() => game.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		currentStreak: integer("current_streak").notNull().default(0),
		bestStreak: integer("best_streak").notNull().default(0),
		correctCount: integer("correct_count").notNull().default(0),
		totalGuesses: integer("total_guesses").notNull().default(0),
		// Earned as the submitter, +50 per person fooled.
		foolPoints: integer("fool_points").notNull().default(0),
		// Earned as a guesser, +100 per correct answer.
		guessPoints: integer("guess_points").notNull().default(0),
		// Last round date this user actually played, for streak continuity.
		lastPlayedDate: date("last_played_date", { mode: "string" }),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [unique().on(table.gameId, table.userId)],
);

export const roundRelations = relations(round, ({ one, many }) => ({
	game: one(game, { fields: [round.gameId], references: [game.id] }),
	bankSong: one(bankSong, {
		fields: [round.bankSongId],
		references: [bankSong.id],
	}),
	guesses: many(guess),
}));

export const guessRelations = relations(guess, ({ one }) => ({
	round: one(round, { fields: [guess.roundId], references: [round.id] }),
	guesser: one(user, {
		fields: [guess.guesserUserId],
		references: [user.id],
	}),
	guessedMember: one(gameMember, {
		fields: [guess.guessedMemberId],
		references: [gameMember.id],
	}),
}));
