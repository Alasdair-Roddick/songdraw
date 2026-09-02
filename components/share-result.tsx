"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShareResult({
	roundNumber,
	correct,
	missed,
	streak,
}: {
	roundNumber: number;
	correct: boolean;
	missed: boolean;
	streak: number;
}) {
	const [copied, setCopied] = useState(false);
	const mark = missed ? "⬜" : correct ? "🟩" : "🟥";

	async function copy() {
		await navigator.clipboard.writeText(
			`SongDraw #${roundNumber} ${mark} streak ${streak}`,
		);
		setCopied(true);
		setTimeout(() => setCopied(false), 1800);
	}

	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			onClick={() => void copy()}
		>
			{copied ? <CheckIcon /> : <CopyIcon />}
			{copied ? "Copied" : "Share result"}
		</Button>
	);
}
