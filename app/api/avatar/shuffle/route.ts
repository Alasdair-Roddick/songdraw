import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { avatarUrl, randomAvatarSeed } from "@/lib/avatar";
import { deleteAvatarIfOwned } from "@/lib/storage";

export async function POST() {
	const requestHeaders = await headers();
	const session = await auth.api.getSession({ headers: requestHeaders });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const previousImage = session.user.image;
	const image = avatarUrl(randomAvatarSeed());

	await auth.api.updateUser({
		headers: requestHeaders,
		body: { image },
	});

	await deleteAvatarIfOwned(previousImage);

	return NextResponse.json({ image });
}
