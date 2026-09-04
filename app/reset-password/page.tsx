"use client";

import { LoaderCircleIcon, TriangleAlertIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordInput } from "@/components/password-input";
import { PasswordStrengthMeter } from "@/components/password-strength";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/lib/auth-client";

function ResetPasswordForm() {
	const router = useRouter();
	const params = useSearchParams();
	// Better Auth's /reset-password/:token callback validates the token, then
	// redirects here with either `token` or `error` — so a dead link never
	// reaches the form at all.
	const token = params.get("token");
	const callbackError = params.get("error");

	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);

		if (password !== confirm) {
			setError("Those two passwords don't match.");
			return;
		}
		if (!token) return;

		setLoading(true);
		const { error: resetError } = await resetPassword({
			newPassword: password,
			token,
		});
		setLoading(false);

		if (resetError) {
			setError(resetError.message ?? "Couldn't reset — request a new link.");
			return;
		}
		router.push("/login");
	}

	if (!token || callbackError) {
		return (
			<Card className="w-full rounded-none border-2 border-foreground shadow-[6px_6px_0_0_var(--color-foreground)] ring-0">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-xl font-display tracking-wide uppercase">
						<TriangleAlertIcon className="size-5" /> Link expired
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="font-mono text-sm text-muted-foreground">
						Reset links work once and last an hour. Ask for a fresh one.
					</p>
				</CardContent>
				<CardFooter className="border-t-2 border-foreground">
					<Button
						asChild
						variant="brand"
						className="h-12 w-full rounded-full text-base"
					>
						<Link href="/forgot-password">Send a new link</Link>
					</Button>
				</CardFooter>
			</Card>
		);
	}

	return (
		<Card className="w-full rounded-none border-2 border-foreground shadow-[6px_6px_0_0_var(--color-foreground)] ring-0">
			<CardHeader>
				<CardTitle className="text-xl font-display tracking-wide uppercase">
					New password
				</CardTitle>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<div className="flex flex-col gap-2">
						<Label htmlFor="password">New password</Label>
						<PasswordInput
							id="password"
							autoComplete="new-password"
							minLength={8}
							autoFocus
							required
							value={password}
							onChange={(e) => setPassword(e.target.value)}
						/>
						<PasswordStrengthMeter password={password} />
					</div>
					<div className="flex flex-col gap-2">
						<Label htmlFor="confirm">Confirm password</Label>
						<PasswordInput
							id="confirm"
							autoComplete="new-password"
							minLength={8}
							required
							value={confirm}
							onChange={(e) => setConfirm(e.target.value)}
						/>
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
						{loading ? "Saving…" : "Save password"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}

export default function ResetPasswordPage() {
	return (
		<AuthShell>
			<Suspense fallback={null}>
				<ResetPasswordForm />
			</Suspense>
		</AuthShell>
	);
}
