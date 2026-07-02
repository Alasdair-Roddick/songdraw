export function randomAvatarSeed() {
	return crypto.randomUUID();
}

export function avatarUrl(seed: string) {
	return `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
}
