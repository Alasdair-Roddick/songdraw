import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { EqMark } from "@/components/eq-mark";
import { UserMenu } from "@/components/user-menu";
import { auth } from "@/lib/auth";

export default async function HomePage() {
	const session = await auth.api.getSession({ headers: await headers() });

	if (!session) {
		redirect("/login");
	}

	return (
		<div className="flex flex-1 flex-col">
			<header className="border-b-2 border-foreground">
				<div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
					<div className="flex items-center gap-2.5">
						<EqMark className="h-9 w-9 px-2 py-1.5" />
						<span className="text-lg font-bold tracking-tighter">SongDraw</span>
					</div>
					<UserMenu
						name={session.user.name}
						email={session.user.email}
						image={session.user.image}
					/>
				</div>
			</header>
			<div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 pb-24 text-center">
				<h1 className="text-3xl font-black tracking-tight uppercase">
					Welcome, {session.user.name}
				</h1>
				<p className="font-mono text-sm text-muted-foreground">
					{session.user.email}
				</p>
			</div>
		</div>
	);
}
