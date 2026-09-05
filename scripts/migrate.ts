import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Applies committed migrations. Bundled by the Dockerfile into a single
 * standalone file so it can run inside the runner image, which is Next's
 * `standalone` output — that tree contains neither drizzle-kit nor even
 * drizzle-orm as resolvable packages (they're compiled into the server bundle),
 * so `bunx drizzle-kit migrate` cannot work there.
 *
 * Runs as the Fly `release_command`, i.e. after the image builds and before any
 * new Machine serves traffic. A non-zero exit aborts the deploy, which is the
 * behaviour we want: shipping code against an unmigrated database is exactly
 * what this is here to prevent.
 */
const url = process.env.MIGRATE_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) {
	console.error("DATABASE_URL (or MIGRATE_DATABASE_URL) is required");
	process.exit(1);
}

// `max: 1` because migrations must run in order on one connection.
//
// Prefer MIGRATE_DATABASE_URL pointing at Supabase's *session* pooler (:5432).
// The app's DATABASE_URL is the transaction pooler (:6543, pgbouncer=true),
// which hands out a different backend per statement — fine for the app, wrong
// for a migration that needs its DDL to stay on one connection.
const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

try {
	await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
	console.log("migrations applied");
	await client.end();
	process.exit(0);
} catch (error) {
	console.error("migration failed", error);
	await client.end({ timeout: 5 }).catch(() => {});
	process.exit(1);
}
