import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bankSong } from "@/lib/db/bank";
import { gameMember } from "@/lib/db/game";
import { guess, round, statSnapshot } from "@/lib/db/round";
import { CORRECT_POINTS, FOOL_POINTS, revealHour } from "@/lib/game-rules";
import { activeMembership } from "@/lib/games";
import { notifyGame } from "@/lib/realtime";
import { roundViewFor } from "@/lib/round";
import { gameDate, isPastRevealHour } from "@/lib/round-date";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id: gameId } = await params;
	const session = await auth.api.getSession({ headers: await headers() });
	if (!session) {
		return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	}

	const membership = await activeMembership(gameId, session.user.id);
	if (!membership) {
		return NextResponse.json({ error: "not a member" }, { status: 403 });
	}

	const body = await request.json().catch(() => null);
	const guessedMemberId =
		typeof body?.memberId === "string" ? body.memberId : "";
	if (!guessedMemberId) {
		return NextResponse.json(
			{ error: "memberId is required" },
			{ status: 400 },
		);
	}

	const [today] = await db
		.select({
			id: round.id,
			status: round.status,
			roundDate: round.roundDate,
			submitterUserId: bankSong.userId,
		})
		.from(round)
		.innerJoin(bankSong, eq(round.bankSongId, bankSong.id))
		.where(and(eq(round.gameId, gameId), eq(round.roundDate, gameDate())))
		.limit(1);

	if (!today) {
		return NextResponse.json({ error: "No round today." }, { status: 404 });
	}
	if (today.status !== "open") {
		return NextResponse.json(
			{ error: "That round has closed." },
			{ status: 409 },
		);
	}
	// The answer is public from the reveal onward, so a guess after it would be
	// free points. The UI hides the picker; this is what actually enforces it.
	if (isPastRevealHour(today.roundDate, revealHour())) {
		return NextResponse.json(
			{ error: "Guessing closed for today — the answer's out." },
			{ status: 409 },
		);
	}
	if (today.submitterUserId === session.user.id) {
		return NextResponse.json(
			{ error: "It's your song — you don't get to guess." },
			{ status: 403 },
		);
	}

	// The guessed member must actually be in this game, or the picker could be
	// used to probe for member ids from elsewhere.
	const [guessedMember] = await db
		.select({ id: gameMember.id, userId: gameMember.userId })
		.from(gameMember)
		.where(
			and(eq(gameMember.id, guessedMemberId), eq(gameMember.gameId, gameId)),
		)
		.limit(1);
	if (!guessedMember) {
		return NextResponse.json({ error: "Unknown member." }, { status: 400 });
	}

	// Scored here, never client-side (GamePlan §6 decision 7).
	const isCorrect = guessedMember.userId === today.submitterUserId;
	const points = isCorrect ? CORRECT_POINTS : 0;

	try {
		await db.transaction(async (tx) => {
			// The unique (round_id, guesser) index is what enforces one attempt;
			// a double-submit raises here rather than scoring twice.
			await tx.insert(guess).values({
				roundId: today.id,
				guesserUserId: session.user.id,
				guessedMemberId,
				isCorrect,
				points,
			});

			await tx
				.insert(statSnapshot)
				.values({
					gameId,
					userId: session.user.id,
					correctCount: isCorrect ? 1 : 0,
					totalGuesses: 1,
					guessPoints: points,
				})
				.onConflictDoUpdate({
					target: [statSnapshot.gameId, statSnapshot.userId],
					set: {
						correctCount: sql`${statSnapshot.correctCount} + ${isCorrect ? 1 : 0}`,
						totalGuesses: sql`${statSnapshot.totalGuesses} + 1`,
						guessPoints: sql`${statSnapshot.guessPoints} + ${points}`,
					},
				});

			// Submission is a bluff: every wrong guess pays the submitter.
			if (!isCorrect) {
				await tx
					.insert(statSnapshot)
					.values({
						gameId,
						userId: today.submitterUserId,
						foolPoints: FOOL_POINTS,
					})
					.onConflictDoUpdate({
						target: [statSnapshot.gameId, statSnapshot.userId],
						set: {
							foolPoints: sql`${statSnapshot.foolPoints} + ${FOOL_POINTS}`,
						},
					});
			}
		});
	} catch (err) {
		// Only a unique violation on (round_id, guesser) means "already guessed".
		// This used to catch everything, so a pooler timeout or a dropped
		// connection told the player they'd already answered — losing their guess
		// and logging nothing. Anything else is ours, and should say so.
		if ((err as { code?: string })?.code === "23505") {
			return NextResponse.json(
				{ error: "You've already guessed today." },
				{ status: 409 },
			);
		}
		console.error(`guess failed for game ${gameId}`, err);
		return NextResponse.json(
			{ error: "Couldn't record that guess — try again." },
			{ status: 500 },
		);
	}

	// Everyone in the room updates at once: the submitter's fooled-count, every
	// guesser's waiting-count, and — if that was the last guess — the reveal.
	await notifyGame(gameId, "round:guessed");

	const view = await roundViewFor(gameId, session.user.id);
	return NextResponse.json(view, { status: 201 });
}
