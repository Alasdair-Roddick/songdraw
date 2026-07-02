"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { signUp } from "@/lib/auth-client";
import { avatarUrl, randomAvatarSeed } from "@/lib/avatar";

const STEP_TRANSITION = { duration: 0.2 };

export default function SignupPage() {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [step, setStep] = useState<1 | 2>(1);

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");

	const [name, setName] = useState("");
	const [avatarSeed, setAvatarSeed] = useState(() => randomAvatarSeed());
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [avatarPreview, setAvatarPreview] = useState<string>(() =>
		avatarUrl(avatarSeed),
	);

	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	function shuffleAvatar() {
		setAvatarFile(null);
		const seed = randomAvatarSeed();
		setAvatarSeed(seed);
		setAvatarPreview(avatarUrl(seed));
	}

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setAvatarFile(file);
		setAvatarPreview(URL.createObjectURL(file));
	}

	function handleStepOneSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setStep(2);
	}

	async function handleStepTwoSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);

		// Sign up with the generated avatar as a baseline — if a photo was
		// picked, it replaces this right after, but the account always ends
		// up with an image either way.
		const { error: signUpError } = await signUp.email({
			email,
			password,
			name,
			image: avatarUrl(avatarSeed),
		});

		if (signUpError) {
			setLoading(false);
			setError(signUpError.message ?? "Couldn't sign up — try again.");
			return;
		}

		if (avatarFile) {
			const formData = new FormData();
			formData.set("file", avatarFile);
			await fetch("/api/avatar", { method: "POST", body: formData });
		}

		setLoading(false);
		router.push("/home");
	}

	return (
		<div className="flex flex-1 items-center justify-center px-6">
			<Card className="w-full max-w-sm overflow-hidden">
				<CardHeader>
					<CardTitle>Sign up · Step {step} of 2</CardTitle>
					<CardDescription>
						Already have an account?{" "}
						<Link href="/login" className="underline underline-offset-4">
							Log in
						</Link>
					</CardDescription>
				</CardHeader>
				<CardContent>
					<AnimatePresence mode="wait" initial={false}>
						{step === 1 ? (
							<motion.form
								key="step-1"
								onSubmit={handleStepOneSubmit}
								className="flex flex-col gap-4"
								initial={{ opacity: 0, x: 24 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -24 }}
								transition={STEP_TRANSITION}
							>
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
										autoComplete="new-password"
										minLength={8}
										required
										value={password}
										onChange={(e) => setPassword(e.target.value)}
									/>
								</div>
								<Button type="submit">Continue</Button>
							</motion.form>
						) : (
							<motion.form
								key="step-2"
								onSubmit={handleStepTwoSubmit}
								className="flex flex-col gap-4"
								initial={{ opacity: 0, x: 24 }}
								animate={{ opacity: 1, x: 0 }}
								exit={{ opacity: 0, x: -24 }}
								transition={STEP_TRANSITION}
							>
								<div className="flex items-center gap-4">
									<Avatar className="size-16">
										<AvatarImage src={avatarPreview} alt="" />
										<AvatarFallback>
											{name.slice(0, 1).toUpperCase()}
										</AvatarFallback>
									</Avatar>
									<div className="flex flex-col gap-1.5">
										<input
											ref={fileInputRef}
											type="file"
											accept="image/jpeg,image/png,image/webp"
											className="hidden"
											onChange={handleFileChange}
										/>
										<Button
											type="button"
											variant="outline"
											size="sm"
											onClick={() => fileInputRef.current?.click()}
										>
											Upload photo
										</Button>
										{!avatarFile && (
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onClick={shuffleAvatar}
											>
												Shuffle avatar
											</Button>
										)}
									</div>
								</div>
								<div className="flex flex-col gap-2">
									<Label htmlFor="name">Display name</Label>
									<Input
										id="name"
										autoComplete="nickname"
										required
										value={name}
										onChange={(e) => setName(e.target.value)}
									/>
								</div>
								{error && <p className="text-sm text-destructive">{error}</p>}
								<div className="flex gap-2">
									<Button
										type="button"
										variant="outline"
										onClick={() => setStep(1)}
									>
										Back
									</Button>
									<Button type="submit" disabled={loading} className="flex-1">
										{loading ? "Signing up…" : "Sign up"}
									</Button>
								</div>
							</motion.form>
						)}
					</AnimatePresence>
				</CardContent>
			</Card>
		</div>
	);
}
