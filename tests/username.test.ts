import assert from "node:assert/strict";
import test from "node:test";
import { auth } from "../lib/auth";
import { usernameError, usernameRules } from "../lib/username";

test("usernames accept letters, numbers, hyphens and underscores", () => {
	for (const name of [
		"OliverBrown",
		"alex",
		"Alex_123",
		"DJ-Alex",
		"A",
		"42",
		"Former_player_a1b2c3",
	]) {
		assert.equal(usernameError(name), null, name);
	}
});

const invalidNames = [
	"",
	"Oliver Brown",
	" Alex",
	"Alex ",
	"Alex\tBrown",
	"Alex\n",
	"Alex\r\n",
	"Alex\u00a0Brown",
	"Alex\u200bBrown",
	"Alex.Brown",
	"Alex@Brown",
	"Alex/Brown",
	"Alex\\Brown",
	"Alex+Brown",
	"Alex🙂",
	"Álex",
	"Ａlex",
	"Alex—Brown",
	"Alex\0",
];

test("usernames reject whitespace, invisible characters and all other punctuation", () => {
	for (const name of invalidNames)
		assert.ok(usernameError(name), JSON.stringify(name));
	assert.deepEqual(usernameRules("Oliver Brown"), {
		noSpaces: false,
		allowedCharacters: true,
	});
	assert.deepEqual(usernameRules("Oliver.Brown"), {
		noSpaces: true,
		allowedCharacters: false,
	});
});

test("server hooks reject invalid names on both signup and profile updates", async () => {
	const hooks = auth.options.databaseHooks?.user;
	assert.ok(hooks?.create?.before);
	assert.ok(hooks?.update?.before);
	for (const name of invalidNames) {
		await assert.rejects(
			() =>
				Promise.resolve(
					hooks.create.before({
						id: "username-validation-test",
						name,
						email: "username-test@example.invalid",
						emailVerified: false,
						createdAt: new Date(),
						updatedAt: new Date(),
					}),
				),
			{ status: "BAD_REQUEST" },
		);
		await assert.rejects(
			() => Promise.resolve(hooks.update.before({ name }, null)),
			{ status: "BAD_REQUEST" },
		);
	}
});

test("image-only updates do not require or rewrite a username", async () => {
	const before = auth.options.databaseHooks?.user?.update?.before;
	assert.ok(before);
	assert.equal(
		await before({ image: "https://example.invalid/avatar.png" }, null),
		undefined,
	);
});
