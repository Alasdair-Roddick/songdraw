import { headers } from "next/headers";
import Link from "next/link";
import { EqMark } from "@/components/eq-mark";
import { NotificationBell } from "@/components/notification-bell";
import { UserMenu } from "@/components/user-menu";
import { auth } from "@/lib/auth";
import { userChannel } from "@/lib/realtime";

export async function AppHeader() {
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) return null;

	// Derived server-side and handed down: the channel name is the only thing
	// standing between a browser with the anon key and someone else's feed.
	const channel = userChannel(session.user.id);

	return (
		<header className="border-b-2 border-foreground">
			<div className="mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-4">
				<Link href="/home" className="flex items-center gap-2.5">
					<EqMark className="h-9 w-9 px-2 py-1.5" />
					<span className="text-lg font-bold tracking-tighter">SongDraw</span>
				</Link>
				<div className="flex items-center gap-1">
					<NotificationBell channel={channel} />
					<UserMenu
						name={session.user.name}
						email={session.user.email}
						image={session.user.image}
					/>
				</div>
			</div>
		</header>
	);
}
