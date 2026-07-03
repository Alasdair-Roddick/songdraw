"use client";

import {
	EyeIcon,
	EyeOffIcon,
	LoaderCircleIcon,
	LockIcon,
	MailIcon,
} from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { signIn } from "@/lib/auth-client";

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
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
		<AuthShell>
			<Card className="w-full">
				<CardHeader>
					<CardTitle>Welcome back</CardTitle>
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
						<div className="flex flex-col gap-2">
							<Label htmlFor="password">Password</Label>
							<div className="relative">
								<LockIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									id="password"
									type={showPassword ? "text" : "password"}
									autoComplete="current-password"
									required
									className="h-10 pr-10 pl-9"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
									aria-label={showPassword ? "Hide password" : "Show password"}
									onClick={() => setShowPassword((v) => !v)}
								>
									{showPassword ? <EyeOffIcon /> : <EyeIcon />}
								</Button>
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
						<Button type="submit" size="lg" disabled={loading}>
							{loading && <LoaderCircleIcon className="animate-spin" />}
							{loading ? "Logging in…" : "Log in"}
						</Button>
					</form>
				</CardContent>
				<CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
					New here?
					<Link
						href="/signup"
						className="font-medium text-foreground underline underline-offset-4"
					>
						Create an account
					</Link>
				</CardFooter>
			</Card>
		</AuthShell>
	);
}
