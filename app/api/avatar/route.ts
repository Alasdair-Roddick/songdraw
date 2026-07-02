import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { deleteAvatarIfOwned, uploadAvatar } from "@/lib/storage";

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request) {
	const requestHeaders = await headers();
	const session = await auth.api.getSession({ headers: requestHeaders });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const formData = await request.formData();
	const file = formData.get("file");
	if (!(file instanceof File)) {
		return NextResponse.json({ error: "missing file" }, { status: 400 });
	}
	if (!ALLOWED_TYPES.includes(file.type)) {
		return NextResponse.json(
			{ error: "unsupported file type" },
			{ status: 400 },
		);
	}
	if (file.size > MAX_SIZE) {
		return NextResponse.json({ error: "file too large" }, { status: 400 });
	}

	const previousImage = session.user.image;
	const image = await uploadAvatar(session.user.id, file);

	await auth.api.updateUser({
		headers: requestHeaders,
		body: { image },
	});

	await deleteAvatarIfOwned(previousImage);

	return NextResponse.json({ image });
}
