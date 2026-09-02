const NTFY_URL = process.env.NTFY_URL;

// Ops alerts for the topics in GamePlan §3 (song-pool-dry, song-draw-failed).
// Best-effort: a dry pool is already a degraded day, and failing to *tell* you
// about it must not also fail the draw job for every other game.
export async function notifyOps(topic: string, message: string) {
	if (!NTFY_URL) return;

	try {
		await fetch(`${NTFY_URL}/${topic}`, {
			method: "POST",
			body: message,
		});
	} catch (err) {
		console.error(`ntfy ${topic} failed`, err);
	}
}
