CREATE TABLE "admin_action" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"correlation_id" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"game_date" text NOT NULL,
	"actor" text NOT NULL,
	"token_fp" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"game_id" text,
	"request_body" jsonb,
	"before_state" jsonb,
	"after_state" jsonb,
	"outcome" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_idempotency" (
	"key" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"response" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_nonce" (
	"nonce" text PRIMARY KEY NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "admin_action_correlation_id_idx" ON "admin_action" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "admin_action_occurred_at_idx" ON "admin_action" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "admin_nonce_seen_at_idx" ON "admin_nonce" USING btree ("seen_at");
--> statement-breakpoint
-- Intentionally unconditional: provision ops/admin-read-role.sql first. A missing
-- role aborts the migration instead of silently shipping without reviewed grants.
GRANT SELECT ON TABLE public.admin_action TO songdraw_admin_ro;
-- Replay state is internal; never grant admin_nonce or admin_idempotency.
