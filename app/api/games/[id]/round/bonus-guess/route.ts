import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bankSong } from "@/lib/db/bank";
import { bonusGuess, bonusRound, round, statSnapshot } from "@/lib/db/round";
import {
	BONUS_CLOSE_POINTS,
	BONUS_EXACT_POINTS,
	revealHour,
} from "@/lib/game-rules";
import { activeMembership } from "@/lib/games";
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
	const guessValue = typeof body?.year === "number" ? body.year : null;
	if (!guessValue || !Number.isInteger(guessValue)) {
		return NextResponse.json(
			{ error: "year is required (integer)" },
			{ status: 400 },
		);
	}

	const [today] = await db
		.select({
			id: round.id,
			status: round.status,
			roundDate: round.roundDate,
		})
		.from(round)
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
	if (isPastRevealHour(today.roundDate, revealHour())) {
		return NextResponse.json(
			{ error: "Bonus guessing closed for today." },
			{ status: 409 },
		);
	}

	const [bonus] = await db
		.select({ id: bonusRound.id, answer: bonusRound.answer })
		.from(bonusRound)
		.where(eq(bonusRound.roundId, today.id))
		.limit(1);

	if (!bonus) {
		return NextResponse.json(
			{ error: "No bonus round today." },
			{ status: 404 },
		);
	}

	const correctYear = Number.parseInt(bonus.answer, 10);
	const diff = Math.abs(guessValue - correctYear);
	const isCorrect = diff === 0;
	const points =
		diff === 0 ? BONUS_EXACT_POINTS : diff === 1 ? BONUS_CLOSE_POINTS : 0;

	try {
		await db.transaction(async (tx) => {
			await tx.insert(bonusGuess).values({
				bonusRoundId: bonus.id,
				userId: session.user.id,
				guessValue: guessValue.toString(),
				isCorrect,
				points,
			});

			if (points > 0) {
				await tx
					.insert(statSnapshot)
					.values({
						gameId,
						userId: session.user.id,
						bonusPoints: points,
					})
					.onConflictDoUpdate({
						target: [statSnapshot.gameId, statSnapshot.userId],
						set: {
							bonusPoints: sql`${statSnapshot.bonusPoints} + ${points}`,
						},
					});
			}
		});
	} catch (err) {
		if ((err as { code?: string })?.code === "23505") {
			return NextResponse.json(
				{ error: "You've already answered the bonus." },
				{ status: 409 },
			);
		}
		console.error(`bonus guess failed for game ${gameId}`, err);
		return NextResponse.json(
			{ error: "Couldn't record that — try again." },
			{ status: 500 },
		);
	}

	return NextResponse.json(
		{
			correct: isCorrect,
			close: diff === 1,
			points,
			answer: correctYear,
		},
		{ status: 201 },
	);
}
