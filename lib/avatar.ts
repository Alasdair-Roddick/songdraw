export function randomAvatarSeed() {
	return crypto.randomUUID();
}

export function avatarUrl(seed: string) {
	return `https://api.dicebear.com/10.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;
}
