export async function register() {
	if (process.env.NEXT_RUNTIME !== "nodejs") return;
	const { validInternalToken } = await import("@/lib/internal-security");
	const token = process.env.ADMIN_API_TOKEN;
	// Unset keeps admin writes disabled; a configured but unsafe value fails boot.
	if (
		token &&
		(!validInternalToken(token) || token === process.env.CRON_TOKEN)
	) {
		throw new Error(
			"ADMIN_API_TOKEN must be a non-placeholder secret of at least 32 characters, different from CRON_TOKEN.",
		);
	}
}
