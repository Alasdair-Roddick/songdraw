import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { feedForUser } from "@/lib/round";

// Today's round across every game you're in — GamePlan M6-5's combined view.
export async function GET() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	return NextResponse.json(await feedForUser(session.user.id));
}
