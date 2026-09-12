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

	// Same rule for the feature-request ingest secret, plus one more: it must
	// not be either of the others. It is held by the admin console only to file
	// requests, so sharing a value with the key that rewrites a live game would
	// hand it that power for free.
	const ingest = process.env.INGEST_SHARED_SECRET;
	if (ingest) {
		if (!validInternalToken(ingest)) {
			throw new Error(
				"INGEST_SHARED_SECRET must be a non-placeholder secret of at least 32 characters.",
			);
		}
		if (ingest === process.env.CRON_TOKEN || ingest === token) {
			throw new Error(
				"INGEST_SHARED_SECRET must differ from CRON_TOKEN and ADMIN_API_TOKEN.",
			);
		}
	}

	// A typo'd or http ingest URL should stop the deploy, not surface as a
	// refusal the first time a player fills in the form.
	if (process.env.ADMIN_INGEST_URL) {
		const { ingestEndpoint } = await import("@/lib/feature-request");
		ingestEndpoint(process.env.ADMIN_INGEST_URL);
	}
}
