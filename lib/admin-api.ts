import { createHash } from "node:crypto";
import { eq, lt, sql } from "drizzle-orm";
import { z } from "zod";
import {
	adminEnvelope,
	readAdminBody,
	verifyAdminSignature,
} from "@/lib/admin-contract";
import { runDaily, sendWakeups, type Wakeup } from "@/lib/daily-job";
import { db } from "@/lib/db";
import { adminAction, adminIdempotency, adminNonce } from "@/lib/db/admin";
import {
	allowInternalRequest,
	authorizedBearer,
	rateLimitResponse,
} from "@/lib/internal-security";
import { cancelInvite, removeMember, setGameStatus } from "@/lib/moderation";
import {
	type Database,
	MutationError,
	type RowChange,
	type Transaction,
} from "@/lib/mutation";
import { gameDate } from "@/lib/round-date";

const id = z.string().min(1).max(200);
const schemas = {
	"run-daily": z.object({}).strict(),
	"game/archive": z
		.object({ gameId: id, status: z.enum(["active", "archived"]) })
		.strict(),
	"member/remove": z.object({ gameId: id, memberId: id }).strict(),
	"invite/cancel": z.object({ inviteId: id }).strict(),
};
export type AdminRoute = keyof typeof schemas;

type Context = {
	changes: RowChange[];
	wakeups: Wakeup[];
	targetType: string | null;
	targetId: string | null;
	gameId: string | null;
};

async function applyAction(
	route: AdminRoute,
	body: unknown,
	tx: Transaction,
	context: Context,
	today: string,
): Promise<Record<string, unknown>> {
	if (route === "run-daily")
		return runDaily(tx, context.changes, context.wakeups, today);
	if (route === "game/archive") {
		const input = schemas[route].parse(body);
		context.targetType = "game";
		context.targetId = context.gameId = input.gameId;
		const updated = await setGameStatus(
			tx,
			input.gameId,
			input.status,
			context.changes,
		);
		context.wakeups.push({
			kind: "game",
			id: input.gameId,
			event: "game:updated",
		});
		return { status: updated.status };
	}
	if (route === "member/remove") {
		const input = schemas[route].parse(body);
		context.targetType = "game_member";
		context.targetId = input.memberId;
		context.gameId = input.gameId;
		const updated = await removeMember(
			tx,
			input.gameId,
			input.memberId,
			undefined,
			context.changes,
		);
		context.wakeups.push(
			{ kind: "game", id: input.gameId, event: "game:members" },
			{ kind: "user", id: updated.userId, event: "game:removed" },
		);
		return { status: "removed" };
	}
	const input = schemas["invite/cancel"].parse(body);
	context.targetType = "game_invite";
	context.targetId = input.inviteId;
	const updated = await cancelInvite(
		tx,
		input.inviteId,
		undefined,
		context.changes,
	);
	context.gameId = updated.gameId;
	context.wakeups.push({
		kind: "user",
		id: updated.inviteeId,
		event: "invite:cancelled",
	});
	return { status: "cancelled" };
}

/** Dependencies are injectable for contract tests against an isolated database. */
export function adminHandler(
	route: AdminRoute,
	database: Database = db,
	allowRequest = allowInternalRequest,
) {
	const path = `/api/internal/admin/${route}`;
	return async (request: Request) => {
		if (!allowRequest(path)) return rateLimitResponse();
		const token = process.env.ADMIN_API_TOKEN;
		if (!authorizedBearer(request, token) || token === process.env.CRON_TOKEN)
			return Response.json({ error: "Unauthorized." }, { status: 401 });
		try {
			const envelope = adminEnvelope(request);
			if (request.method !== "POST" || envelope.path !== path)
				throw new MutationError(400, "Invalid admin endpoint or method.");
			const wakeups: Wakeup[] = [];
			const response = await database.transaction(async (tx) => {
				// Read before signature verification, then atomically insert after it.
				// The unique key also catches simultaneous copies of the same nonce.
				const [seen] = await tx
					.select()
					.from(adminNonce)
					.where(eq(adminNonce.nonce, envelope.nonce));
				if (seen)
					throw new MutationError(409, "Admin nonce has already been used.");
				const rawBody = await readAdminBody(request);
				const bodyHash = verifyAdminSignature(
					request,
					envelope,
					rawBody,
					token,
				);
				const [claimed] = await tx
					.insert(adminNonce)
					.values({ nonce: envelope.nonce })
					.onConflictDoNothing()
					.returning();
				if (!claimed)
					throw new MutationError(409, "Admin nonce has already been used.");
				// Transaction-scoped locks work through the Supabase pooler. Hold this
				// until BOTH the domain mutation and stored response have committed.
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtext(${`songdraw:admin:${envelope.key}`}))`,
				);
				const [cached] = await tx
					.select()
					.from(adminIdempotency)
					.where(eq(adminIdempotency.key, envelope.key));
				if (cached) {
					if (
						cached.action !== route ||
						cached.response.bodyHash !== bodyHash ||
						cached.response.actor !== envelope.actor
					)
						throw new MutationError(
							409,
							"Idempotency key belongs to a different request.",
						);
					return cached.response;
				}
				const context: Context = {
					changes: [],
					wakeups,
					targetType: null,
					targetId: null,
					gameId: null,
				};
				const today = gameDate();
				let requestBody: unknown = null;
				let status = 200;
				let body: Record<string, unknown>;
				let rejectedBefore: object | null = null;
				try {
					if (
						request.headers
							.get("content-type")
							?.split(";")[0]
							.trim()
							.toLowerCase() !== "application/json"
					)
						throw new MutationError(
							415,
							"Content-Type must be application/json.",
						);
					let parsed: unknown;
					try {
						parsed = JSON.parse(
							new TextDecoder("utf-8", { fatal: true }).decode(rawBody),
						);
					} catch {
						throw new MutationError(400, "Request body must be valid JSON.");
					}
					const validated = schemas[route].safeParse(parsed);
					if (!validated.success)
						throw new MutationError(
							400,
							"Request body does not match this admin action.",
						);
					// Only known fields reach the audit log; never persist arbitrary keys.
					requestBody = validated.data;
					body = await tx.transaction((mutationTx) =>
						applyAction(route, requestBody, mutationTx, context, today),
					);
				} catch (error) {
					if (!(error instanceof MutationError)) throw error;
					status = error.status;
					body = { error: error.message };
					rejectedBefore = error.before;
					context.changes = [];
					wakeups.length = 0;
				}
				await tx.insert(adminAction).values({
					correlationId: envelope.correlationId,
					gameDate: today,
					actor: envelope.actor,
					tokenFp: createHash("sha256")
						.update(token)
						.digest("hex")
						.slice(0, 12),
					action: route,
					targetType: context.targetType,
					targetId: context.targetId,
					gameId: context.gameId,
					requestBody,
					beforeState:
						(rejectedBefore
							? [{ table: context.targetType, row: rejectedBefore }]
							: null) ??
						context.changes.map(({ table, before }) => ({
							table,
							row: before,
						})),
					afterState:
						(rejectedBefore
							? [{ table: context.targetType, row: rejectedBefore }]
							: null) ??
						context.changes.map(({ table, after }) => ({ table, row: after })),
					outcome: status < 400 ? "applied" : "rejected",
				});
				const result = { status, body, bodyHash, actor: envelope.actor };
				await tx
					.insert(adminIdempotency)
					.values({ key: envelope.key, action: route, response: result });
				// Five minutes exceeds the entire timestamp acceptance window, including
				// future-dated requests. Replay responses also prune via later actions.
				await tx
					.delete(adminNonce)
					.where(
						lt(
							adminNonce.seenAt,
							sql`clock_timestamp() - interval '5 minutes'`,
						),
					);
				return result;
			});
			await sendWakeups(wakeups);
			return Response.json(response.body, { status: response.status });
		} catch (error) {
			if (error instanceof MutationError)
				return Response.json(
					{ error: error.message },
					{ status: error.status },
				);
			// A connection failure at COMMIT may mean it committed. The caller must
			// record unknown and retry with the SAME key and a freshly signed nonce.
			console.error(`admin action ${route} failed`);
			return Response.json(
				{
					error:
						"Admin action could not be confirmed; retry with the same idempotency key.",
				},
				{ status: 500 },
			);
		}
	};
}
