import { relations } from "drizzle-orm";
import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
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

export const gameRelations = relations(game, ({ many }) => ({
	members: many(gameMember),
}));

export const gameMemberRelations = relations(gameMember, ({ one }) => ({
	game: one(game, { fields: [gameMember.gameId], references: [game.id] }),
	user: one(user, { fields: [gameMember.userId], references: [user.id] }),
}));
