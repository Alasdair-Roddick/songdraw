import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UserMenu } from "@/components/user-menu";
import { auth } from "@/lib/auth";

export default async function HomePage() {
	const session = await auth.api.getSession({ headers: await headers() });

	if (!session) {
		redirect("/login");
	}

	return (
		<div className="flex flex-1 flex-col">
			<header className="flex items-center justify-end gap-4 p-4 sm:p-6">
				<UserMenu
					name={session.user.name}
					email={session.user.email}
					image={session.user.image}
				/>
			</header>
			<div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 pb-24 text-center">
				<h1 className="text-2xl font-semibold">Welcome, {session.user.name}</h1>
				<p className="text-muted-foreground">{session.user.email}</p>
			</div>
		</div>
	);
}
