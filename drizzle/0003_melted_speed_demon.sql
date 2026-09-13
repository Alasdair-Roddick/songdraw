CREATE TABLE "bonus_guess" (
	"id" text PRIMARY KEY NOT NULL,
	"bonus_round_id" text NOT NULL,
	"user_id" text NOT NULL,
	"guess_value" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bonus_guess_bonus_round_id_user_id_unique" UNIQUE("bonus_round_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "bonus_round" (
	"id" text PRIMARY KEY NOT NULL,
	"round_id" text NOT NULL,
	"bonus_type" text DEFAULT 'year' NOT NULL,
	"answer" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "track_asset" ADD COLUMN "release_year" integer;--> statement-breakpoint
ALTER TABLE "stat_snapshot" ADD COLUMN "bonus_points" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "bonus_guess" ADD CONSTRAINT "bonus_guess_bonus_round_id_bonus_round_id_fk" FOREIGN KEY ("bonus_round_id") REFERENCES "public"."bonus_round"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bonus_guess" ADD CONSTRAINT "bonus_guess_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bonus_round" ADD CONSTRAINT "bonus_round_round_id_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."round"("id") ON DELETE cascade ON UPDATE no action;