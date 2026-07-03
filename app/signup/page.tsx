"use client";

import {
	ArrowLeftIcon,
	ArrowRightIcon,
	DicesIcon,
	EyeIcon,
	EyeOffIcon,
	LoaderCircleIcon,
	LockIcon,
	MailIcon,
	UploadIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { signUp } from "@/lib/auth-client";
import { avatarUrl, randomAvatarSeed } from "@/lib/avatar";
import { cn } from "@/lib/utils";

const STEP_TITLES = [
	"Create your account",
	"Choose your name",
	"Pick your look",
];

const stepVariants = {
	enter: (dir: number) => ({ opacity: 0, x: dir * 32 }),
	center: { opacity: 1, x: 0 },
	exit: (dir: number) => ({ opacity: 0, x: dir * -32 }),
};

const STRENGTH = [
	{ label: "Weak", className: "bg-destructive" },
	{ label: "Okay", className: "bg-amber-500" },
	{ label: "Good", className: "bg-lime-500" },
	{ label: "Strong", className: "bg-emerald-500" },
];

function passwordStrength(pw: string) {
	if (!pw) return 0;
	let score = 0;
	if (pw.length >= 8) score++;
	if (pw.length >= 12) score++;
	if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
	if (/\d/.test(pw) || /[^a-zA-Z0-9]/.test(pw)) score++;
	return Math.max(1, score);
}

function makeSeeds() {
	return Array.from({ length: 6 }, () => randomAvatarSeed());
}

export default function SignupPage() {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [{ step, dir }, setNav] = useState({ step: 0, dir: 1 });

	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [name, setName] = useState("");

	const [seeds, setSeeds] = useState<string[]>(() => makeSeeds());
	const [selectedSeed, setSelectedSeed] = useState<string | null>(null);
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const [filePreview, setFilePreview] = useState<string | null>(null);

	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const activeSeed = selectedSeed ?? seeds[0];
	const preview =
		avatarFile && filePreview ? filePreview : avatarUrl(activeSeed);
	const strength = passwordStrength(password);

	function go(next: number) {
		setError(null);
		setNav((nav) => ({ step: next, dir: next > nav.step ? 1 : -1 }));
	}

	function shuffle() {
		const next = makeSeeds();
		setSeeds(next);
		setSelectedSeed(next[0]);
		setAvatarFile(null);
	}

	function pickSeed(seed: string) {
		setSelectedSeed(seed);
		setAvatarFile(null);
	}

	function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		setAvatarFile(file);
		setFilePreview(URL.createObjectURL(file));
	}

	async function handleFinish(e: React.FormEvent) {
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
			image: avatarUrl(activeSeed),
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
		<AuthShell>
			<Card className="w-full">
				<CardHeader>
					<div className="mb-2 flex gap-1.5">
						{STEP_TITLES.map((title, i) => (
							<div
								key={title}
								className={cn(
									"h-1 flex-1 rounded-full transition-colors duration-300",
									i <= step ? "bg-primary" : "bg-muted",
								)}
							/>
						))}
					</div>
					<CardTitle>{STEP_TITLES[step]}</CardTitle>
				</CardHeader>
				<CardContent>
					<AnimatePresence mode="wait" initial={false} custom={dir}>
						{step === 0 && (
							<motion.form
								key="account"
								custom={dir}
								variants={stepVariants}
								initial="enter"
								animate="center"
								exit="exit"
								transition={{ duration: 0.2 }}
								onSubmit={(e) => {
									e.preventDefault();
									go(1);
								}}
								className="flex flex-col gap-4"
							>
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
											autoComplete="new-password"
											minLength={8}
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
											aria-label={
												showPassword ? "Hide password" : "Show password"
											}
											onClick={() => setShowPassword((v) => !v)}
										>
											{showPassword ? <EyeOffIcon /> : <EyeIcon />}
										</Button>
									</div>
									{password && (
										<div className="flex items-center gap-2">
											<div className="flex flex-1 gap-1">
												{STRENGTH.map((level, i) => (
													<div
														key={level.label}
														className={cn(
															"h-1 flex-1 rounded-full transition-colors duration-300",
															i < strength
																? STRENGTH[strength - 1].className
																: "bg-muted",
														)}
													/>
												))}
											</div>
											<span className="text-xs text-muted-foreground">
												{STRENGTH[strength - 1].label}
											</span>
										</div>
									)}
								</div>
								<Button type="submit" size="lg">
									Continue
									<ArrowRightIcon />
								</Button>
							</motion.form>
						)}
						{step === 1 && (
							<motion.form
								key="name"
								custom={dir}
								variants={stepVariants}
								initial="enter"
								animate="center"
								exit="exit"
								transition={{ duration: 0.2 }}
								onSubmit={(e) => {
									e.preventDefault();
									go(2);
								}}
								className="flex flex-col gap-4"
							>
								<div className="flex flex-col gap-2">
									<Label htmlFor="name">Display name</Label>
									<Input
										id="name"
										autoComplete="nickname"
										autoFocus
										required
										maxLength={32}
										className="h-10"
										value={name}
										onChange={(e) => setName(e.target.value)}
									/>
								</div>
								<div className="flex gap-2">
									<Button
										type="button"
										variant="outline"
										size="lg"
										onClick={() => go(0)}
									>
										<ArrowLeftIcon />
										Back
									</Button>
									<Button type="submit" size="lg" className="flex-1">
										Continue
										<ArrowRightIcon />
									</Button>
								</div>
							</motion.form>
						)}
						{step === 2 && (
							<motion.form
								key="look"
								custom={dir}
								variants={stepVariants}
								initial="enter"
								animate="center"
								exit="exit"
								transition={{ duration: 0.2 }}
								onSubmit={handleFinish}
								className="flex flex-col gap-4"
							>
								<div className="flex justify-center">
									<motion.div
										key={preview}
										initial={{ scale: 0.8, opacity: 0.5 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{
											type: "spring",
											stiffness: 300,
											damping: 20,
										}}
									>
										<Avatar className="size-20 ring-2 ring-border">
											<AvatarImage src={preview} alt="" />
											<AvatarFallback>
												{name.slice(0, 1).toUpperCase()}
											</AvatarFallback>
										</Avatar>
									</motion.div>
								</div>
								<div className="flex justify-between gap-2">
									{seeds.map((seed, i) => (
										<motion.button
											key={seed}
											type="button"
											initial={{ scale: 0.5, opacity: 0 }}
											animate={{ scale: 1, opacity: 1 }}
											transition={{
												delay: i * 0.05,
												type: "spring",
												stiffness: 400,
												damping: 22,
											}}
											onClick={() => pickSeed(seed)}
											aria-pressed={!avatarFile && seed === activeSeed}
											className={cn(
												"rounded-full ring-offset-2 ring-offset-card transition-shadow",
												!avatarFile && seed === activeSeed
													? "ring-2 ring-primary"
													: "hover:ring-2 hover:ring-muted-foreground/40",
											)}
										>
											<Avatar className="size-11">
												<AvatarImage src={avatarUrl(seed)} alt="" />
											</Avatar>
										</motion.button>
									))}
								</div>
								<div className="flex gap-2">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="flex-1"
										onClick={shuffle}
									>
										<DicesIcon />
										Shuffle
									</Button>
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
										className="flex-1"
										onClick={() => fileInputRef.current?.click()}
									>
										<UploadIcon />
										Upload photo
									</Button>
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
								<div className="flex gap-2">
									<Button
										type="button"
										variant="outline"
										size="lg"
										onClick={() => go(1)}
									>
										<ArrowLeftIcon />
										Back
									</Button>
									<Button
										type="submit"
										size="lg"
										disabled={loading}
										className="flex-1"
									>
										{loading && <LoaderCircleIcon className="animate-spin" />}
										{loading ? "Signing up…" : "Sign up"}
									</Button>
								</div>
							</motion.form>
						)}
					</AnimatePresence>
				</CardContent>
				<CardFooter className="justify-center gap-1 text-sm text-muted-foreground">
					Have an account?
					<Link
						href="/login"
						className="font-medium text-foreground underline underline-offset-4"
					>
						Log in
					</Link>
				</CardFooter>
			</Card>
		</AuthShell>
	);
}
