import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import test from "node:test";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { type AdminRoute, adminHandler } from "../lib/admin-api";
import { runDaily } from "../lib/daily-job";
import { schema } from "../lib/db";
import { adminAction, adminIdempotency, adminNonce } from "../lib/db/admin";
import { bankSong } from "../lib/db/bank";
import { game, gameInvite, gameMember } from "../lib/db/game";
import { guess, round, statSnapshot } from "../lib/db/round";
import { user } from "../lib/db/schema";
import { trackAsset } from "../lib/db/track-asset";
import { drawForGame } from "../lib/draw";
import { createInternalRateLimiter } from "../lib/internal-security";
import {
	cancelInvite,
	removeMember,
	respondToInvite,
	transferOwnership,
} from "../lib/moderation";
import { gameDate, previousDate } from "../lib/round-date";

const url = process.env.ADMIN_TEST_DATABASE_URL;
const token = "integration-test-secret-never-use-in-production-123456789";

function signed(
	route: AdminRoute,
	body: unknown,
	options: {
		key?: string;
		nonce?: string;
		correlationId?: string;
		timestamp?: number;
		signature?: string;
		raw?: string;
	} = {},
) {
	const raw = options.raw ?? JSON.stringify(body);
	const path = `/api/internal/admin/${route}`;
	const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
	const nonce = options.nonce ?? randomBytes(16).toString("hex");
	const canonical = [
		"v1",
		"POST",
		path,
		timestamp,
		nonce,
		"operator@example.com",
		createHash("sha256").update(raw).digest("hex"),
	].join("\n");
	return new Request(`http://localhost${path}`, {
		method: "POST",
		body: raw,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
			"X-Admin-Actor": "operator@example.com",
			"X-Admin-Timestamp": timestamp,
			"X-Admin-Nonce": nonce,
			"X-Admin-Correlation-Id": options.correlationId ?? randomUUID(),
			"Idempotency-Key": options.key ?? randomUUID(),
			"X-Admin-Signature":
				options.signature ??
				`v1=${createHmac("sha256", token).update(canonical).digest("hex")}`,
		},
	});
}

test("admin write contract on disposable Postgres", {
	skip: !url,
}, async (t) => {
	// This suite resets tables. Only this explicitly named localhost test DB is allowed.
	const target = new URL(url as string);
	assert.ok(["localhost", "127.0.0.1"].includes(target.hostname));
	assert.equal(target.pathname, "/songdraw_admin_test");
	const client = postgres(url as string, {
		prepare: false,
		max: 10,
		onnotice: () => {},
	});
	const database = drizzle(client, { schema });
	const oldToken = process.env.ADMIN_API_TOKEN;
	process.env.ADMIN_API_TOKEN = token;
	t.after(async () => {
		if (oldToken === undefined) delete process.env.ADMIN_API_TOKEN;
		else process.env.ADMIN_API_TOKEN = oldToken;
		await client.end();
	});
	await client`DO $$ BEGIN CREATE ROLE songdraw_admin_ro NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$`;
	await migrate(database, { migrationsFolder: "./drizzle" });
	const handle = (route: AdminRoute, request: Request) =>
		adminHandler(route, database, () => true)(request);
	async function reset() {
		await client`TRUNCATE admin_action, admin_nonce, admin_idempotency, "user", track_asset CASCADE`;
	}
	async function fixture() {
		await reset();
		const users = await database
			.insert(user)
			.values(
				Array.from({ length: 5 }, (_, i) => ({
					id: randomUUID(),
					name: `Player ${i}`,
					email: `${i}@test.invalid`,
				})),
			)
			.returning();
		const [room] = await database
			.insert(game)
			.values({ name: "Test room", ownerId: users[0].id })
			.returning();
		const members = await database
			.insert(gameMember)
			.values(
				users.slice(0, 4).map((person, i) => ({
					gameId: room.id,
					userId: person.id,
					role: i === 0 ? "owner" : "member",
				})),
			)
			.returning();
		const [invite] = await database
			.insert(gameInvite)
			.values({
				gameId: room.id,
				inviterId: users[0].id,
				inviteeId: users[4].id,
			})
			.returning();
		return { users, room, members, invite };
	}
	await t.test("migration grants only the evidence table", async () => {
		const [permissions] =
			await client`SELECT has_table_privilege('songdraw_admin_ro', 'admin_action', 'SELECT') AS action, has_table_privilege('songdraw_admin_ro', 'admin_nonce', 'SELECT') AS nonce, has_table_privilege('songdraw_admin_ro', 'admin_idempotency', 'SELECT') AS idempotency`;
		assert.deepEqual(permissions, {
			action: true,
			nonce: false,
			idempotency: false,
		});
	});
	await t.test(
		"archive/unarchive records signed identity, correlation, fingerprint and exact rows",
		async () => {
			const { room } = await fixture();
			const correlationId = randomUUID();
			const response = await handle(
				"game/archive",
				signed(
					"game/archive",
					{ gameId: room.id, status: "archived" },
					{ correlationId },
				),
			);
			assert.equal(response.status, 200);
			assert.deepEqual(await response.json(), { status: "archived" });
			const [record] = await database.select().from(adminAction);
			assert.equal(record.actor, "operator@example.com");
			assert.equal(record.correlationId, correlationId);
			assert.equal(
				record.tokenFp,
				createHash("sha256").update(token).digest("hex").slice(0, 12),
			);
			assert.equal(record.gameDate, gameDate());
			assert.equal(record.gameId, room.id);
			assert.deepEqual(record.beforeState, [
				{ table: "game", row: JSON.parse(JSON.stringify(room)) },
			]);
			assert.deepEqual(record.afterState, [
				{
					table: "game",
					row: JSON.parse(JSON.stringify({ ...room, status: "archived" })),
				},
			]);
			assert.equal(
				(
					await handle(
						"game/archive",
						signed("game/archive", { gameId: room.id, status: "active" }),
					)
				).status,
				200,
			);
		},
	);
	await t.test(
		"simultaneous same-key retries apply once; changed body/route refuses",
		async () => {
			const { room, members } = await fixture();
			const key = randomUUID();
			const body = { gameId: room.id, memberId: members[1].id };
			const responses = await Promise.all(
				Array.from({ length: 5 }, () =>
					handle("member/remove", signed("member/remove", body, { key })),
				),
			);
			for (const response of responses) {
				assert.equal(response.status, 200);
				assert.deepEqual(await response.json(), { status: "removed" });
			}
			assert.equal((await database.select().from(adminAction)).length, 1);
			assert.equal((await database.select().from(adminIdempotency)).length, 1);
			assert.equal((await database.select().from(adminNonce)).length, 5);
			assert.equal(
				(
					await handle(
						"member/remove",
						signed(
							"member/remove",
							{ ...body, memberId: members[2].id },
							{ key },
						),
					)
				).status,
				409,
			);
			assert.equal(
				(
					await handle(
						"game/archive",
						signed(
							"game/archive",
							{ gameId: room.id, status: "archived" },
							{ key },
						),
					)
				).status,
				409,
			);
		},
	);
	await t.test(
		"nonce replay precedes signature and idempotency; concurrent copies refuse",
		async () => {
			const { room } = await fixture();
			const options = {
				key: randomUUID(),
				nonce: randomBytes(16).toString("hex"),
			};
			const body = { gameId: room.id, status: "archived" };
			const responses = await Promise.all([
				handle("game/archive", signed("game/archive", body, options)),
				handle("game/archive", signed("game/archive", body, options)),
			]);
			assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
			assert.equal(
				(
					await handle(
						"game/archive",
						signed("game/archive", body, { ...options, signature: "invalid" }),
					)
				).status,
				409,
			);
			assert.equal((await database.select().from(adminAction)).length, 1);
		},
	);
	await t.test(
		"authentication, validation and rate limits are clean refusals",
		async () => {
			await fixture();
			const badAuth = signed("run-daily", {});
			badAuth.headers.set("authorization", "Bearer wrong");
			assert.equal((await handle("run-daily", badAuth)).status, 401);
			assert.equal(
				(await handle("run-daily", signed("run-daily", {}, { timestamp: 0 })))
					.status,
				401,
			);
			assert.equal(
				(
					await handle(
						"run-daily",
						signed("run-daily", {}, { signature: "v1=bad" }),
					)
				).status,
				401,
			);
			assert.equal((await database.select().from(adminNonce)).length, 0);
			assert.equal(
				(
					await handle(
						"run-daily",
						signed("run-daily", {}, { raw: "not json" }),
					)
				).status,
				400,
			);
			assert.equal(
				(
					await handle(
						"run-daily",
						signed("run-daily", { secret: "never persist this" }),
					)
				).status,
				400,
			);
			const records = await database.select().from(adminAction);
			assert.equal(records.length, 2);
			assert.ok(
				records.every(
					(r) => r.outcome === "rejected" && r.requestBody === null,
				),
			);
			const limited = adminHandler(
				"run-daily",
				database,
				createInternalRateLimiter(1),
			);
			assert.equal(
				(await limited(signed("run-daily", { invalid: true }))).status,
				400,
			);
			const response = await limited(signed("run-daily", {}));
			assert.equal(response.status, 429);
			assert.equal(response.headers.get("retry-after"), "60");
		},
	);
	await t.test(
		"owner removal refuses, missing targets refuse, invite cancel preserves the row",
		async () => {
			const { room, members, invite } = await fixture();
			assert.equal(
				(
					await handle(
						"member/remove",
						signed("member/remove", {
							gameId: room.id,
							memberId: members[0].id,
						}),
					)
				).status,
				409,
			);
			assert.equal(
				(
					await handle(
						"member/remove",
						signed("member/remove", {
							gameId: "other-room",
							memberId: members[1].id,
						}),
					)
				).status,
				404,
			);
			assert.equal(
				(
					await handle(
						"game/archive",
						signed("game/archive", { gameId: "missing", status: "archived" }),
					)
				).status,
				404,
			);
			assert.equal(
				(
					await handle(
						"invite/cancel",
						signed("invite/cancel", { inviteId: invite.id }),
					)
				).status,
				200,
			);
			const [cancelled] = await database
				.select()
				.from(gameInvite)
				.where(eq(gameInvite.id, invite.id));
			assert.equal(cancelled.status, "cancelled");
			assert.ok(cancelled.respondedAt);
			assert.equal(
				(
					await handle(
						"invite/cancel",
						signed("invite/cancel", { inviteId: invite.id }),
					)
				).status,
				404,
			);
			const [owner] = await database
				.select()
				.from(gameMember)
				.where(eq(gameMember.id, members[0].id));
			assert.equal(owner.status, "active");
		},
	);
	await t.test(
		"audit failure rolls back mutation, nonce and key; same request can then succeed",
		async () => {
			const { room } = await fixture();
			await client`CREATE OR REPLACE FUNCTION fail_admin_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$`;
			await client`CREATE TRIGGER fail_admin_audit BEFORE INSERT ON admin_action FOR EACH ROW EXECUTE FUNCTION fail_admin_audit()`;
			const options = {
				key: randomUUID(),
				nonce: randomBytes(16).toString("hex"),
			};
			const body = { gameId: room.id, status: "archived" };
			try {
				assert.equal(
					(await handle("game/archive", signed("game/archive", body, options)))
						.status,
					500,
				);
				const [unchanged] = await database
					.select()
					.from(game)
					.where(eq(game.id, room.id));
				assert.equal(unchanged.status, "active");
				assert.equal((await database.select().from(adminNonce)).length, 0);
				assert.equal(
					(await database.select().from(adminIdempotency)).length,
					0,
				);
			} finally {
				await client`DROP TRIGGER fail_admin_audit ON admin_action`;
				await client`DROP FUNCTION fail_admin_audit()`;
			}
			assert.equal(
				(await handle("game/archive", signed("game/archive", body, options)))
					.status,
				200,
			);
		},
	);
	await t.test(
		"cron/admin overlap settles oldest first once and draws once; all written rows are audited",
		async () => {
			const { room, users, members } = await fixture();
			const today = gameDate();
			const yesterday = previousDate(today);
			const dayBefore = previousDate(yesterday);
			const tracks = await database
				.insert(trackAsset)
				.values(
					Array.from({ length: 4 }, (_, i) => ({
						provider: "itunes",
						providerTrackId: String(i),
						title: `Track ${i}`,
						artist: "Artist",
					})),
				)
				.returning();
			await database
				.insert(bankSong)
				.values(
					tracks.map((track) => ({ userId: users[0].id, trackId: track.id })),
				);
			for (const date of [dayBefore, yesterday]) {
				const drawn = await drawForGame(room.id, date, database);
				assert.equal(drawn.status, "created");
				if (drawn.status !== "created")
					throw new Error("Expected created round");
				await database.insert(guess).values({
					roundId: drawn.roundId,
					guesserUserId: users[1].id,
					guessedMemberId: members[0].id,
					isCorrect: true,
					points: 100,
				});
			}
			// Queue cron behind the admin transaction, guaranteeing the audit contains
			// settlement while still exercising overlapping open transactions.
			let release: () => void = () => {};
			const ready = new Promise<void>((resolve) => {
				release = resolve;
			});
			let continueAdmin: () => void = () => {};
			const proceed = new Promise<void>((resolve) => {
				continueAdmin = resolve;
			});
			const key = randomUUID();
			const admin = database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtext('songdraw:daily'))`,
				);
				release();
				await proceed;
				return adminHandler(
					"run-daily",
					tx,
					() => true,
				)(signed("run-daily", {}, { key }));
			});
			await ready;
			const cron = runDaily(database);
			continueAdmin();
			const [response, cronResult] = await Promise.all([admin, cron]);
			assert.equal(response.status, 200);
			const result = await response.json();
			assert.deepEqual(result, {
				date: today,
				closed: 2,
				created: 1,
				exists: 0,
				dry: 0,
				below_minimum: 0,
				failed: 0,
			});
			assert.equal(cronResult.closed, 0);
			assert.equal(cronResult.exists, 1);
			const retry = await handle("run-daily", signed("run-daily", {}, { key }));
			assert.deepEqual(await retry.json(), result);
			const stats = await database.select().from(statSnapshot);
			for (const person of users.slice(0, 2))
				assert.equal(
					stats.find((s) => s.userId === person.id)?.currentStreak,
					2,
				);
			assert.equal(
				stats.find((s) => s.userId === users[2].id)?.currentStreak,
				0,
			);
			assert.equal((await database.select().from(round)).length, 3);
			const [record] = await database.select().from(adminAction);
			const after = record.afterState as {
				table: string;
				row: Record<string, unknown>;
			}[];
			assert.equal(after.filter((r) => r.table === "stat_snapshot").length, 8);
			assert.equal(after.filter((r) => r.table === "round").length, 3);
			assert.equal(after.filter((r) => r.table === "bank_song").length, 1);
			assert.equal((await database.select().from(adminAction)).length, 1);
		},
	);
	await t.test(
		"player acceptance and admin cancellation cannot both win",
		async () => {
			const { invite, users } = await fixture();
			const outcomes = await Promise.allSettled([
				database.transaction((tx) => cancelInvite(tx, invite.id)),
				database.transaction((tx) =>
					respondToInvite(tx, invite.id, users[4].id, "accept"),
				),
			]);
			assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
			const [current] = await database
				.select()
				.from(gameInvite)
				.where(eq(gameInvite.id, invite.id));
			const joined = await database
				.select()
				.from(gameMember)
				.where(eq(gameMember.userId, users[4].id));
			assert.equal(joined.length, current.status === "accepted" ? 1 : 0);
		},
	);
	await t.test(
		"ownership transfer racing removal keeps an active owner",
		async () => {
			const { room, users, members } = await fixture();
			const outcomes = await Promise.allSettled([
				database.transaction((tx) => removeMember(tx, room.id, members[1].id)),
				database.transaction((tx) =>
					transferOwnership(tx, room.id, users[0].id, users[1].id),
				),
			]);
			assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 1);
			const [current] = await database
				.select()
				.from(game)
				.where(eq(game.id, room.id));
			const [owner] = await database
				.select()
				.from(gameMember)
				.where(eq(gameMember.userId, current.ownerId));
			assert.equal(owner.status, "active");
			assert.equal(owner.role, "owner");
		},
	);
	await t.test(
		"daily counts preserve the member floor, dry rooms and archived exclusion",
		async () => {
			const { room, users } = await fixture();
			const [short, archived] = await database
				.insert(game)
				.values([
					{ name: "Short", ownerId: users[0].id },
					{ name: "Archived", ownerId: users[0].id, status: "archived" },
				])
				.returning();
			await database
				.insert(gameMember)
				.values([
					{ gameId: short.id, userId: users[0].id },
					...users
						.slice(0, 4)
						.map((person) => ({ gameId: archived.id, userId: person.id })),
				]);
			const response = await handle("run-daily", signed("run-daily", {}));
			assert.equal(response.status, 200);
			assert.deepEqual(await response.json(), {
				date: gameDate(),
				closed: 0,
				created: 0,
				exists: 0,
				dry: 1,
				below_minimum: 1,
				failed: 0,
			});
			assert.equal((await database.select().from(round)).length, 0);
			assert.equal(
				(await database.select().from(game).where(eq(game.id, room.id)))[0]
					.status,
				"active",
			);
		},
	);
	await t.test(
		"one failed draw rolls back its savepoint and still reports other successful games",
		async () => {
			const { room, users } = await fixture();
			await database
				.update(gameMember)
				.set({ status: "left" })
				.where(
					and(
						eq(gameMember.gameId, room.id),
						eq(gameMember.userId, users[1].id),
					),
				);
			const [failedRoom] = await database
				.insert(game)
				.values({ id: "!failed-room", name: "Fail draw", ownerId: users[1].id })
				.returning();
			await database
				.insert(gameMember)
				.values(
					users
						.slice(1, 4)
						.map((person) => ({ gameId: failedRoom.id, userId: person.id })),
				);
			const tracks = await database
				.insert(trackAsset)
				.values(
					[0, 1].map((i) => ({
						provider: "itunes",
						providerTrackId: String(i),
						title: `Track ${i}`,
						artist: "Artist",
					})),
				)
				.returning();
			await database.insert(bankSong).values(
				tracks.map((track, i) => ({
					trackId: track.id,
					userId: users[i].id,
				})),
			);
			await client`CREATE OR REPLACE FUNCTION fail_draw() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS (SELECT 1 FROM game WHERE id = NEW.game_id AND name = 'Fail draw') THEN RAISE EXCEPTION 'test draw failure'; END IF; RETURN NEW; END $$`;
			await client`CREATE TRIGGER fail_draw BEFORE INSERT ON round FOR EACH ROW EXECUTE FUNCTION fail_draw()`;
			try {
				const response = await handle("run-daily", signed("run-daily", {}));
				assert.equal(response.status, 200);
				const result = await response.json();
				assert.equal(result.created, 1);
				assert.equal(result.failed, 1);
				assert.equal(result.dry, 0);
				assert.equal((await database.select().from(round)).length, 1);
				const [created] = await database.select().from(round);
				assert.equal(created.gameId, room.id);
				const [record] = await database.select().from(adminAction);
				const after = record.afterState as {
					table: string;
					row: Record<string, unknown>;
				}[];
				assert.equal(
					after.filter((change) => change.table === "round").length,
					1,
				);
				assert.equal(
					after.filter((change) => change.table === "bank_song").length,
					1,
				);
			} finally {
				await client`DROP TRIGGER fail_draw ON round`;
				await client`DROP FUNCTION fail_draw()`;
			}
		},
	);

	await t.test(
		"settlement records the real before-image when a guess creates stats concurrently",
		async () => {
			const { room, users } = await fixture();
			const [track] = await database
				.insert(trackAsset)
				.values({
					provider: "itunes",
					providerTrackId: "concurrent",
					title: "Concurrent",
					artist: "Artist",
				})
				.returning();
			await database
				.insert(bankSong)
				.values({ userId: users[0].id, trackId: track.id });
			await drawForGame(room.id, previousDate(gameDate()), database);
			await client`CREATE OR REPLACE FUNCTION pause_stat_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_advisory_xact_lock(912092); RETURN NEW; END $$`;
			await client`CREATE TRIGGER pause_stat_insert BEFORE INSERT ON stat_snapshot FOR EACH ROW EXECUTE FUNCTION pause_stat_insert()`;
			let pending: Promise<Response> | undefined;
			try {
				await database.transaction(async (tx) => {
					await tx.execute(sql`select pg_advisory_xact_lock(912092)`);
					pending = handle("run-daily", signed("run-daily", {}));
					// Wait for settlement's insert to reach the trigger after its absent-row
					// read, then commit the simulated guesser's insert ahead of it.
					let blocked = false;
					for (let attempt = 0; attempt < 500; attempt++) {
						const [locks] =
							await client`SELECT EXISTS(SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND objid = 912092 AND NOT granted) AS blocked`;
						if (locks.blocked) {
							blocked = true;
							break;
						}
						await new Promise((resolve) => setTimeout(resolve, 10));
					}
					assert.equal(blocked, true);
					await tx.insert(statSnapshot).values(
						users.slice(0, 4).map((person) => ({
							gameId: room.id,
							userId: person.id,
							correctCount: 7,
							totalGuesses: 7,
							guessPoints: 700,
						})),
					);
				});
				assert.ok(pending);
				assert.equal((await pending).status, 200);
				const [record] = await database.select().from(adminAction);
				const before = record.beforeState as {
					table: string;
					row: Record<string, unknown> | null;
				}[];
				const stats = before.filter(
					(change) => change.table === "stat_snapshot",
				);
				assert.equal(stats.length, 4);
				assert.ok(
					stats.every(
						(change) =>
							change.row?.correctCount === 7 && change.row?.guessPoints === 700,
					),
				);
				const after = await database.select().from(statSnapshot);
				assert.ok(
					after.every(
						(row) => row.correctCount === 7 && row.guessPoints === 700,
					),
				);
			} finally {
				await pending;
				await client`DROP TRIGGER pause_stat_insert ON stat_snapshot`;
				await client`DROP FUNCTION pause_stat_insert()`;
			}
		},
	);
	await t.test("nonce cleanup preserves recent nonces", async () => {
		const { room } = await fixture();
		await database.insert(adminNonce).values({
			nonce: "a".repeat(32),
			seenAt: new Date(Date.now() - 600_000),
		});
		assert.equal(
			(
				await handle(
					"game/archive",
					signed("game/archive", { gameId: room.id, status: "archived" }),
				)
			).status,
			200,
		);
		assert.equal((await database.select().from(adminNonce)).length, 1);
	});
});
