"use client";

import { LoaderCircleIcon, MailCheckIcon, MailIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);

		// `redirectTo` is where Better Auth's token callback lands the user once
		// it has validated the token — see app/reset-password.
		const { error: resetError } = await requestPasswordReset({
			email,
			redirectTo: "/reset-password",
		});

		setLoading(false);
		if (resetError) {
			setError(resetError.message ?? "Couldn't send the email — try again.");
			return;
		}
		setSent(true);
	}

	// Deliberately identical whether or not the address exists — the endpoint
	// answers the same way, and saying "no such account" would turn this form
	// into a way to test who has one.
	if (sent) {
		return (
			<AuthShell>
				<Card className="w-full rounded-(--radius-frame) border-2 border-rule shadow-(--shadow-lift-lg) ring-0">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-xl font-display tracking-wide uppercase">
							<MailCheckIcon className="size-5" /> Check your email
						</CardTitle>
					</CardHeader>
					<CardContent>
						<p className="font-mono text-sm text-muted-foreground">
							If an account uses {email}, a reset link is on its way. It works
							once and expires in an hour.
						</p>
					</CardContent>
					<CardFooter className="justify-center border-t-2 border-rule text-sm">
						<Link
							href="/login"
							className="font-semibold text-foreground underline underline-offset-4"
						>
							Back to log in
						</Link>
					</CardFooter>
				</Card>
			</AuthShell>
		);
	}

	return (
		<AuthShell>
			<Card className="w-full rounded-(--radius-frame) border-2 border-rule shadow-(--shadow-lift-lg) ring-0">
				<CardHeader>
					<CardTitle className="text-xl font-display tracking-wide uppercase">
						Forgot password
					</CardTitle>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<Label htmlFor="email">Email</Label>
							<div className="relative">
								<MailIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									id="email"
									type="email"
									autoComplete="email"
									autoFocus
									required
									className="h-10 pl-9"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
								/>
							</div>
						</div>
						{error && (
							<motion.p
								key={error}
								animate={{ x: [0, -6, 6, -3, 3, 0] }}
								transition={{ duration: 0.35 }}
								className="text-sm text-destructive"
							>
								{error}
							</motion.p>
						)}
						<Button
							type="submit"
							variant="brand"
							className="h-12 rounded-full text-base"
							disabled={loading}
						>
							{loading && <LoaderCircleIcon className="animate-spin" />}
							{loading ? "Sending…" : "Send reset link"}
						</Button>
					</form>
				</CardContent>
				<CardFooter className="justify-center gap-1 border-t-2 border-rule text-sm text-muted-foreground">
					Remembered it?
					<Link
						href="/login"
						className="font-semibold text-foreground underline underline-offset-4"
					>
						Log in
					</Link>
				</CardFooter>
			</Card>
		</AuthShell>
	);
}
