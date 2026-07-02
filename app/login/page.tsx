"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/auth-client";

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);

		const { error: signInError } = await signIn.email({ email, password });

		setLoading(false);
		if (signInError) {
			setError(signInError.message ?? "Couldn't log in — check your details.");
			return;
		}
		router.push("/home");
	}

	return (
		<div className="flex flex-1 items-center justify-center px-6">
			<Card className="w-full max-w-sm">
				<CardHeader>
					<CardTitle>Log in</CardTitle>
					<CardDescription>
						Don't have an account?{" "}
						<Link href="/signup" className="underline underline-offset-4">
							Sign up
						</Link>
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<div className="flex flex-col gap-2">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								autoComplete="email"
								required
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
						</div>
						<div className="flex flex-col gap-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								type="password"
								autoComplete="current-password"
								required
								value={password}
								onChange={(e) => setPassword(e.target.value)}
							/>
						</div>
						{error && <p className="text-sm text-destructive">{error}</p>}
						<Button type="submit" disabled={loading}>
							{loading ? "Logging in…" : "Log in"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
