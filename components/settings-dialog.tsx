"use client";

import {
	CheckIcon,
	DicesIcon,
	LoaderCircleIcon,
	MailIcon,
	UploadIcon,
	UserIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PasswordInput } from "@/components/password-input";
import { PasswordStrengthMeter } from "@/components/password-strength";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { UsernameHint } from "@/components/username-hint";
import { authClient } from "@/lib/auth-client";
import { usernameError } from "@/lib/username";

function initialsFor(name: string) {
	return name
		.trim()
		.split(/\s+/)
		.map((part) => part[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<span className="font-mono text-xs font-semibold tracking-widest text-muted-foreground uppercase">
			{children}
		</span>
	);
}

function ErrorText({ error }: { error: string | null }) {
	if (!error) return null;
	return (
		<motion.p
			key={error}
			animate={{ x: [0, -6, 6, -3, 3, 0] }}
			transition={{ duration: 0.35 }}
			className="text-sm text-destructive"
		>
			{error}
		</motion.p>
	);
}

export function SettingsDialog({
	open,
	onOpenChange,
	name: initialName,
	email: initialEmail,
	image,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	name: string;
	email: string;
	image: string | null | undefined;
}) {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [avatarUploading, setAvatarUploading] = useState(false);
	const [avatarShuffling, setAvatarShuffling] = useState(false);
	const [avatarError, setAvatarError] = useState<string | null>(null);

	const [name, setName] = useState(initialName);
	const [nameSaving, setNameSaving] = useState(false);
	const [nameError, setNameError] = useState<string | null>(null);

	const [email, setEmail] = useState(initialEmail);
	const [emailSaving, setEmailSaving] = useState(false);
	const [emailError, setEmailError] = useState<string | null>(null);

	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [passwordSaving, setPasswordSaving] = useState(false);
	const [passwordError, setPasswordError] = useState<string | null>(null);
	const [passwordSuccess, setPasswordSuccess] = useState(false);

	const [deletePassword, setDeletePassword] = useState("");
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;

		setAvatarError(null);
		setAvatarUploading(true);

		const formData = new FormData();
		formData.set("file", file);
		const res = await fetch("/api/avatar", { method: "POST", body: formData });

		setAvatarUploading(false);
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			setAvatarError(body?.error ?? "Upload failed — try again.");
			return;
		}
		router.refresh();
	}

	async function handleAvatarShuffle() {
		setAvatarError(null);
		setAvatarShuffling(true);
		const res = await fetch("/api/avatar/shuffle", { method: "POST" });
		setAvatarShuffling(false);
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			setAvatarError(body?.error ?? "Couldn't shuffle avatar — try again.");
			return;
		}
		router.refresh();
	}

	async function handleNameSave() {
		setNameError(null);
		const validationError = usernameError(name);
		if (validationError) {
			setNameError(validationError);
			return;
		}
		setNameSaving(true);
		const { error } = await authClient.updateUser({ name });
		setNameSaving(false);
		if (error) {
			setNameError(error.message ?? "Couldn't update name.");
			return;
		}
		router.refresh();
	}

	async function handleEmailSave() {
		setEmailError(null);
		setEmailSaving(true);
		const { error } = await authClient.changeEmail({ newEmail: email });
		setEmailSaving(false);
		if (error) {
			setEmailError(error.message ?? "Couldn't update email.");
			return;
		}
		router.refresh();
	}

	async function handlePasswordSave() {
		setPasswordError(null);
		setPasswordSuccess(false);
		setPasswordSaving(true);
		const { error } = await authClient.changePassword({
			currentPassword,
			newPassword,
		});
		setPasswordSaving(false);
		if (error) {
			setPasswordError(error.message ?? "Couldn't update password.");
			return;
		}
		setCurrentPassword("");
		setNewPassword("");
		setPasswordSuccess(true);
	}

	async function handleDeleteAccount() {
		setDeleteError(null);
		setDeleting(true);
		const res = await fetch("/api/account", {
			method: "DELETE",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ password: deletePassword }),
		});
		setDeleting(false);
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			setDeleteError(body?.error ?? "Couldn't close your account.");
			return;
		}
		router.push("/login");
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className="max-h-[85vh] overflow-y-auto rounded-(--radius-frame) border-2 border-rule sm:max-w-md"
				aria-describedby={undefined}
			>
				<DialogHeader>
					<DialogTitle className="font-display font-extrabold tracking-tight">
						Settings
					</DialogTitle>
				</DialogHeader>

				<div className="flex flex-col gap-5">
					<div className="flex items-center gap-4">
						<input
							ref={fileInputRef}
							type="file"
							accept="image/jpeg,image/png,image/webp"
							className="hidden"
							onChange={handleAvatarChange}
						/>
						<motion.div
							key={image ?? "fallback"}
							initial={{ scale: 0.8, opacity: 0.5 }}
							animate={{ scale: 1, opacity: 1 }}
							transition={{ type: "spring", stiffness: 300, damping: 20 }}
						>
							<Avatar className="size-16 ring-2 ring-foreground">
								{image && <AvatarImage src={image} alt={name} />}
								<AvatarFallback>{initialsFor(name)}</AvatarFallback>
							</Avatar>
						</motion.div>
						<div className="flex flex-col gap-1.5">
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={avatarUploading || avatarShuffling}
								onClick={() => fileInputRef.current?.click()}
							>
								{avatarUploading ? (
									<LoaderCircleIcon className="animate-spin" />
								) : (
									<UploadIcon />
								)}
								{avatarUploading ? "Uploading…" : "Upload photo"}
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={avatarUploading || avatarShuffling}
								onClick={handleAvatarShuffle}
							>
								{avatarShuffling ? (
									<LoaderCircleIcon className="animate-spin" />
								) : (
									<DicesIcon />
								)}
								{avatarShuffling ? "Shuffling…" : "Shuffle"}
							</Button>
						</div>
					</div>
					<ErrorText error={avatarError} />

					<Separator />

					<div className="flex flex-col gap-2">
						<Label htmlFor="settings-name">Username</Label>
						<div className="flex gap-2">
							<div className="relative flex-1">
								<UserIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									id="settings-name"
									autoComplete="username"
									autoCapitalize="none"
									autoCorrect="off"
									spellCheck={false}
									aria-describedby="settings-username-hint"
									aria-invalid={name.length > 0 && !!usernameError(name)}
									className="h-10 pl-9"
									value={name}
									onChange={(e) => setName(e.target.value)}
								/>
							</div>
							<Button
								type="button"
								variant="outline"
								size="lg"
								disabled={
									nameSaving || !!usernameError(name) || name === initialName
								}
								onClick={handleNameSave}
							>
								{nameSaving && <LoaderCircleIcon className="animate-spin" />}
								Save
							</Button>
						</div>
						<UsernameHint name={name} id="settings-username-hint" />
						<ErrorText error={nameError} />
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="settings-email">Email</Label>
						<div className="flex gap-2">
							<div className="relative flex-1">
								<MailIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
								<Input
									id="settings-email"
									type="email"
									className="h-10 pl-9"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
								/>
							</div>
							<Button
								type="button"
								variant="outline"
								size="lg"
								disabled={
									emailSaving || !email.trim() || email === initialEmail
								}
								onClick={handleEmailSave}
							>
								{emailSaving && <LoaderCircleIcon className="animate-spin" />}
								Save
							</Button>
						</div>
						<ErrorText error={emailError} />
					</div>

					<Separator />

					<div className="flex flex-col gap-2">
						<SectionLabel>Change password</SectionLabel>
						<PasswordInput
							id="settings-current-password"
							placeholder="Current password"
							autoComplete="current-password"
							value={currentPassword}
							onChange={(e) => setCurrentPassword(e.target.value)}
						/>
						<PasswordInput
							id="settings-new-password"
							placeholder="New password"
							autoComplete="new-password"
							minLength={8}
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
						/>
						<PasswordStrengthMeter password={newPassword} />
						<Button
							type="button"
							variant="outline"
							disabled={passwordSaving || !currentPassword || !newPassword}
							onClick={handlePasswordSave}
						>
							{passwordSaving && <LoaderCircleIcon className="animate-spin" />}
							{passwordSaving ? "Saving…" : "Update password"}
						</Button>
						<ErrorText error={passwordError} />
						{passwordSuccess && (
							<motion.p
								initial={{ opacity: 0, y: -4 }}
								animate={{ opacity: 1, y: 0 }}
								className="flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400"
							>
								<CheckIcon className="size-4" />
								Password updated
							</motion.p>
						)}
					</div>

					<Separator />

					<div className="flex flex-col gap-3 border-2 border-destructive p-4">
						<SectionLabel>Danger zone</SectionLabel>
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button type="button" variant="destructive">
									Delete account
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent className="rounded-(--radius-frame) border-2 border-rule">
								<AlertDialogHeader>
									<AlertDialogTitle>Close your account?</AlertDialogTitle>
									<AlertDialogDescription>
										This closes your account for good — you'll be signed out and
										won't be able to log back in. Past rounds stay in your rooms
										under a former-player name, so nobody else loses their
										history. Enter your password to confirm.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<PasswordInput
									placeholder="Password"
									autoComplete="current-password"
									value={deletePassword}
									onChange={(e) => setDeletePassword(e.target.value)}
								/>
								<ErrorText error={deleteError} />
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<Button
										type="button"
										variant="destructive"
										disabled={deleting || !deletePassword}
										onClick={handleDeleteAccount}
									>
										{deleting && <LoaderCircleIcon className="animate-spin" />}
										{deleting ? "Deleting…" : "Delete account"}
									</Button>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
