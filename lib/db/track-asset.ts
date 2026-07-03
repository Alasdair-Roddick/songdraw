import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

export const trackAsset = pgTable(
	"track_asset",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		provider: text("provider").notNull(),
		providerTrackId: text("provider_track_id").notNull(),
		title: text("title").notNull(),
		artist: text("artist").notNull(),
		album: text("album"),
		artworkUrl: text("artwork_url"),
		previewUrl: text("preview_url"),
		cachedAt: timestamp("cached_at").defaultNow().notNull(),
	},
	(table) => [unique().on(table.provider, table.providerTrackId)],
);
