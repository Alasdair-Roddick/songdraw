import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Never cached: a health check that can be served from a cache isn't one.
export const dynamic = "force-dynamic";

/**
 * Liveness *and* readiness. Both deploy targets previously health-checked `/`,
 * which is the marketing landing page — it renders perfectly with a dead
 * database, so the app could be completely unable to serve a round while every
 * check stayed green.
 *
 * Deliberately unauthenticated and free of detail: it reports up or down, never
 * the connection string or the error text.
 */
export async function GET() {
	try {
		await db.execute(sql`select 1`);
		return NextResponse.json({ ok: true });
	} catch (err) {
		console.error("health check failed", err);
		return NextResponse.json({ ok: false }, { status: 503 });
	}
}
