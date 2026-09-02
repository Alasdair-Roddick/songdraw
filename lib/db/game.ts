import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { user } from "./schema";

export const game = pgTable("game", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull(),
	ownerId: text("owner_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	status: text("status").notNull().default("active"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const gameMember = pgTable(
	"game_member",
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
		role: text("role").notNull().default("member"), // "owner" | "member"
		status: text("status").notNull().default("active"), // "active" | "left"
		joinedAt: timestamp("joined_at").defaultNow().notNull(),
	},
	(table) => [unique().on(table.gameId, table.userId)],
);

// One row per person-per-game. Re-inviting someone who declined flips the
// existing row back to "pending" rather than inserting a second one, which is
// why the unique constraint can stay this strict.
export const gameInvite = pgTable(
	"game_invite",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		gameId: text("game_id")
			.notNull()
			.references(() => game.id, { onDelete: "cascade" }),
		inviterId: text("inviter_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		inviteeId: text("invitee_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		// "pending" | "accepted" | "declined" | "cancelled"
		status: text("status").notNull().default("pending"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		respondedAt: timestamp("responded_at"),
	},
	(table) => [
		unique().on(table.gameId, table.inviteeId),
		// Drives the bell badge — "my pending invites" is the hottest read.
		index("game_invite_invitee_status_idx").on(table.inviteeId, table.status),
		index("game_invite_game_status_idx").on(table.gameId, table.status),
	],
);

export const gameRelations = relations(game, ({ many }) => ({
	members: many(gameMember),
	invites: many(gameInvite),
}));

export const gameInviteRelations = relations(gameInvite, ({ one }) => ({
	game: one(game, { fields: [gameInvite.gameId], references: [game.id] }),
	inviter: one(user, {
		fields: [gameInvite.inviterId],
		references: [user.id],
		relationName: "inviter",
	}),
	invitee: one(user, {
		fields: [gameInvite.inviteeId],
		references: [user.id],
		relationName: "invitee",
	}),
}));

export const gameMemberRelations = relations(gameMember, ({ one }) => ({
	game: one(game, { fields: [gameMember.gameId], references: [game.id] }),
	user: one(user, { fields: [gameMember.userId], references: [user.id] }),
}));
