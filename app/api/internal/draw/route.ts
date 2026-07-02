import { NextResponse } from "next/server";

export async function POST(request: Request) {
	const authHeader = request.headers.get("authorization");
	const expected = `Bearer ${process.env.CRON_TOKEN}`;

	if (!process.env.CRON_TOKEN || authHeader !== expected) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	// Draw algorithm lands in M4 — this just proves the cron sidecar can
	// reach and authenticate against the app.
	return NextResponse.json({ ok: true });
}
