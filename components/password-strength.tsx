"use client";

import { cn } from "@/lib/utils";

const LEVELS = [
	{ label: "Weak", className: "bg-destructive" },
	{ label: "Okay", className: "bg-amber-500" },
	{ label: "Good", className: "bg-lime-500" },
	{ label: "Strong", className: "bg-emerald-500" },
];

function passwordStrength(pw: string) {
	let score = 0;
	if (pw.length >= 8) score++;
	if (pw.length >= 12) score++;
	if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
	if (/\d/.test(pw) || /[^a-zA-Z0-9]/.test(pw)) score++;
	return Math.max(1, score);
}

export function PasswordStrengthMeter({ password }: { password: string }) {
	if (!password) return null;
	const strength = passwordStrength(password);

	return (
		<div className="flex items-center gap-2">
			<div className="flex flex-1 gap-1">
				{LEVELS.map((level, i) => (
					<div
						key={level.label}
						className={cn(
							"h-1 flex-1 rounded-full transition-colors duration-300",
							i < strength ? LEVELS[strength - 1].className : "bg-muted",
						)}
					/>
				))}
			</div>
			<span className="text-xs text-muted-foreground">
				{LEVELS[strength - 1].label}
			</span>
		</div>
	);
}
