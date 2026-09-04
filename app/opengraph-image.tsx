import { createSocialImage, socialImageSize } from "./social-image";

export const alt = "SongDraw — a daily music game for friends";
export const size = socialImageSize;
export const contentType = "image/png";

export default async function OpenGraphImage() {
	return createSocialImage();
}
