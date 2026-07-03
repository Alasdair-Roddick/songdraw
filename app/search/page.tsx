import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SongSearch } from "@/components/song-search";
import { auth } from "@/lib/auth";

export default async function SearchPage() {
	const session = await auth.api.getSession({ headers: await headers() });

	if (!session) {
		redirect("/login");
	}

	return (
		<div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-6 py-10">
			<h1 className="text-2xl font-black tracking-tight uppercase">
				Search for a song
			</h1>
			<SongSearch />
		</div>
	);
}
