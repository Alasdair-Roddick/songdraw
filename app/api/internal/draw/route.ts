import { runDaily, sendWakeups, type Wakeup } from "@/lib/daily-job";
import {
	allowInternalRequest,
	authorizedBearer,
	rateLimitResponse,
} from "@/lib/internal-security";

export const runtime = "nodejs";

export async function POST(request: Request) {
	if (!allowInternalRequest("/api/internal/draw")) return rateLimitResponse();
	if (!authorizedBearer(request, process.env.CRON_TOKEN)) {
		return Response.json({ error: "Unauthorized." }, { status: 401 });
	}
	try {
		const wakeups: Wakeup[] = [];
		const result = await runDaily(undefined, [], wakeups);
		await sendWakeups(wakeups);
		return Response.json(result);
	} catch {
		console.error("daily job could not be confirmed");
		return Response.json(
			{ error: "Daily job could not be confirmed; retry the job." },
			{ status: 500 },
		);
	}
}
