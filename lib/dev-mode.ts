/**
 * Enables destructive local testing tools only when explicitly opted into.
 * NODE_ENV remains a hard production boundary, so copying DEV_MODE to a
 * production environment can never expose those tools.
 */
export function isDevMode() {
	return (
		process.env.NODE_ENV !== "production" && process.env.DEV_MODE === "true"
	);
}
