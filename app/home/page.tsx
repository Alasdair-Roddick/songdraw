import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CreateGameDialog } from "@/components/create-game-dialog";
import { EqMark } from "@/components/eq-mark";
import { UserMenu } from "@/components/user-menu";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { game, gameMember } from "@/lib/db/game";

export default async function HomePage() {
	const session = await auth.api.getSession({ headers: await headers() });

	if (!session) {
		redirect("/login");
	}

	const games = await db
		.select({ game, role: gameMember.role })
		.from(gameMember)
		.innerJoin(game, eq(gameMember.gameId, game.id))
		.where(eq(gameMember.userId, session.user.id));

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
			<div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-6 py-8">
				<div className="flex items-center justify-between">
					<h2 className="text-lg font-bold tracking-tight uppercase">
						Your games
					</h2>
					<CreateGameDialog />
				</div>
				{games.length === 0 ? (
					<p className="font-mono text-sm text-muted-foreground">
						No games yet — create one to get started.
					</p>
				) : (
					<div className="flex flex-col divide-y-2 divide-foreground border-2 border-foreground">
						{games.map(({ game: g, role }) => (
							<div key={g.id} className="flex items-center justify-between p-3">
								<span className="font-medium">{g.name}</span>
								<span className="font-mono text-xs text-muted-foreground uppercase">
									{role}
								</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
