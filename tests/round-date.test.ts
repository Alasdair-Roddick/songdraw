import assert from "node:assert/strict";
import test from "node:test";
import {
	gameDate,
	isPastRevealHour,
	previousDate,
	revealInstant,
} from "../lib/round-date";

test("game dates use Australia/Adelaide rather than the server timezone", () => {
	assert.equal(gameDate(new Date("2026-01-15T13:45:00Z")), "2026-01-16");
	assert.equal(gameDate(new Date("2026-01-15T12:45:00Z")), "2026-01-15");
});

test("reveal deadline respects Adelaide daylight saving", () => {
	assert.equal(
		isPastRevealHour("2026-01-15", 17, new Date("2026-01-15T06:15:00Z")),
		false,
	);
	assert.equal(
		isPastRevealHour("2026-01-15", 17, new Date("2026-01-15T06:45:00Z")),
		true,
	);
	assert.equal(
		isPastRevealHour("2026-06-15", 17, new Date("2026-06-15T07:15:00Z")),
		false,
	);
	assert.equal(
		isPastRevealHour("2026-06-15", 17, new Date("2026-06-15T07:45:00Z")),
		true,
	);
});

test("reveal instants and previous dates remain correct around DST", () => {
	assert.equal(
		revealInstant("2026-01-15", 17).toISOString(),
		"2026-01-15T06:30:00.000Z",
	);
	assert.equal(
		revealInstant("2026-06-15", 17).toISOString(),
		"2026-06-15T07:30:00.000Z",
	);
	assert.equal(previousDate("2026-10-05"), "2026-10-04");
});
