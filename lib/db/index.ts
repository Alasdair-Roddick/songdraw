import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as bankSchema from "./bank";
import * as gameSchema from "./game";
import * as roundSchema from "./round";
import * as authSchema from "./schema";
import * as trackAssetSchema from "./track-asset";

const schema = {
	...authSchema,
	...trackAssetSchema,
	...gameSchema,
	...bankSchema,
	...roundSchema,
};

// Supabase's transaction pooler (the `?pgbouncer=true` port 6543 URL) hands a
// different backend to each statement, so server-side prepared statements —
// postgres.js's default — break under it. `max` is kept small for the same
// reason: many app instances share one 200-connection pooler budget.
//
// Cached on globalThis because Next's dev HMR re-evaluates this module on every
// edit. Without it each reload opens a fresh pool and orphans the previous one,
// which exhausts the pooler within a normal editing session.
const globalForDb = globalThis as unknown as {
	songdrawDb?: ReturnType<typeof postgres>;
};

// Next evaluates route modules while building the image, before Compose injects
// runtime secrets. The container entrypoint validates DATABASE_URL before the
// server starts; this harmless fallback keeps the build secret-free.
const databaseUrl = process.env.DATABASE_URL ?? "postgres://localhost/songdraw";

const client =
	globalForDb.songdrawDb ??
	postgres(databaseUrl, {
		prepare: false,
		max: 10,
		idle_timeout: 20,
	});

if (process.env.NODE_ENV !== "production") globalForDb.songdrawDb = client;

export const db = drizzle(client, { schema });
