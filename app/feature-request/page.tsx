import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { FeatureRequestForm } from "@/components/feature-request-form";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Feature request" };

export default async function FeatureRequestPage() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) redirect("/login");

	return (
		<div className="flex flex-1 flex-col">
			<AppHeader />
			<main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
				<div className="mb-8 space-y-2">
					<p className="font-mono text-xs font-semibold tracking-widest text-muted-foreground uppercase">
						Feature request
					</p>
					<h1 className="font-display text-4xl font-extrabold tracking-tight">
						Ask for something
					</h1>
					<p className="font-mono text-sm text-muted-foreground">
						Broken, missing or annoying — all three belong here.
					</p>
				</div>
				{/* The email is the session's, never a field: it is where the reply
				    goes, so it is shown rather than asked for. */}
				<FeatureRequestForm email={session.user.email} />
			</main>
		</div>
	);
}
