const APP_URL = (process.env.APP_URL ?? "https://songdraw.fly.dev").replace(
	/\/$/,
	"",
);
const CRON_TOKEN = process.env.CRON_TOKEN;

if (!CRON_TOKEN) {
	throw new Error("CRON_TOKEN is not set");
}

const adelaideClock = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Australia/Adelaide",
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	hourCycle: "h23",
});

function adelaideNow() {
	const parts = Object.fromEntries(
		adelaideClock
			.formatToParts()
			.filter((part) => part.type !== "literal")
			.map((part) => [part.type, part.value]),
	);

	return {
		date: `${parts.year}-${parts.month}-${parts.day}`,
		hour: Number(parts.hour),
	};
}

let completedDate = null;

async function drawIfDue() {
	const { date, hour } = adelaideNow();
	// Keep trying through the first hour in case Fly is briefly unavailable at
	// midnight. The draw endpoint itself is idempotent, so a restarted Machine
	// can safely retry without creating a second round.
	if (hour !== 0 || completedDate === date) return;

	try {
		const response = await fetch(`${APP_URL}/api/internal/draw`, {
			method: "POST",
			headers: { Authorization: `Bearer ${CRON_TOKEN}` },
			signal: AbortSignal.timeout(30_000),
		});
		const body = await response.text();

		if (!response.ok) {
			throw new Error(`draw request failed (${response.status}): ${body}`);
		}

		const result = JSON.parse(body);
		if (result.failed > 0) {
			throw new Error(`draw failed for ${result.failed} game(s): ${body}`);
		}

		completedDate = date;
		console.log(`daily draw completed for ${date}`, result);
	} catch (error) {
		console.error(`daily draw attempt for ${date} failed`, error);
	}
}

console.log("Fly daily-draw scheduler started (Australia/Adelaide midnight)");
await drawIfDue();
setInterval(drawIfDue, 60_000);
