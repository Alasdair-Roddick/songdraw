import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const adminNonce = pgTable(
	"admin_nonce",
	{
		nonce: text("nonce").primaryKey(),
		seenAt: timestamp("seen_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [index("admin_nonce_seen_at_idx").on(table.seenAt)],
);

export const adminIdempotency = pgTable("admin_idempotency", {
	key: text("key").primaryKey(),
	action: text("action").notNull(),
	response: jsonb("response")
		.$type<{
			status: number;
			body: Record<string, unknown>;
			bodyHash: string;
			actor: string;
		}>()
		.notNull(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const adminAction = pgTable(
	"admin_action",
	{
		id: text("id").primaryKey().default(sql`gen_random_uuid()::text`),
		correlationId: text("correlation_id").notNull(),
		occurredAt: timestamp("occurred_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		gameDate: text("game_date").notNull(),
		actor: text("actor").notNull(),
		tokenFp: text("token_fp").notNull(),
		action: text("action").notNull(),
		targetType: text("target_type"),
		targetId: text("target_id"),
		gameId: text("game_id"),
		requestBody: jsonb("request_body"),
		beforeState: jsonb("before_state"),
		afterState: jsonb("after_state"),
		outcome: text("outcome").$type<"applied" | "rejected">().notNull(),
	},
	(table) => [
		index("admin_action_correlation_id_idx").on(table.correlationId),
		index("admin_action_occurred_at_idx").on(table.occurredAt),
	],
);
