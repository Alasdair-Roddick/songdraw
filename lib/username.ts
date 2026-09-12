export const USERNAME_RULES_MESSAGE =
	"Use letters A–Z, numbers, hyphens (-) or underscores (_). No spaces.";

export function usernameRules(name: string) {
	return {
		noSpaces: !/\s/.test(name),
		allowedCharacters: !/[^A-Za-z0-9_\-\s]/.test(name),
	};
}

export function usernameError(name: string): string | null {
	if (!name) return "Pick a username.";
	const rules = usernameRules(name);
	return rules.noSpaces && rules.allowedCharacters
		? null
		: USERNAME_RULES_MESSAGE;
}
