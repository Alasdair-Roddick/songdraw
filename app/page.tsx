import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Landing } from "@/components/landing";
import { auth } from "@/lib/auth";

// Auth gate only. The marketing markup is a client component so it can use
// motion/react — per docs/style-guide.md, server pages stay CSS-only.
export default async function Home() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (session) redirect("/home");

	return <Landing />;
}
