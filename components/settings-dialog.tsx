"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";

function initialsFor(name: string) {
	return name
		.trim()
		.split(/\s+/)
		.map((part) => part[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
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
		const { error } = await authClient.deleteUser({ password: deletePassword });
		setDeleting(false);
		if (error) {
			setDeleteError(error.message ?? "Couldn't delete account.");
			return;
		}
		router.push("/login");
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Settings</DialogTitle>
					<DialogDescription>
						Manage your profile and account.
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-6">
					<div className="flex items-center gap-4">
						<Avatar className="size-16">
							{image && <AvatarImage src={image} alt={name} />}
							<AvatarFallback>{initialsFor(name)}</AvatarFallback>
						</Avatar>
						<div className="flex flex-col gap-1.5">
							<input
								ref={fileInputRef}
								type="file"
								accept="image/jpeg,image/png,image/webp"
								className="hidden"
								onChange={handleAvatarChange}
							/>
							<div className="flex flex-col gap-1.5">
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={avatarUploading || avatarShuffling}
									onClick={() => fileInputRef.current?.click()}
								>
									{avatarUploading ? "Uploading…" : "Change avatar"}
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="sm"
									disabled={avatarUploading || avatarShuffling}
									onClick={handleAvatarShuffle}
								>
									{avatarShuffling ? "Shuffling…" : "Shuffle avatar"}
								</Button>
							</div>
							{avatarError && (
								<p className="text-sm text-destructive">{avatarError}</p>
							)}
						</div>
					</div>

					<Separator />

					<div className="flex flex-col gap-2">
						<Label htmlFor="settings-name">Display name</Label>
						<div className="flex gap-2">
							<Input
								id="settings-name"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
							<Button
								type="button"
								variant="outline"
								disabled={nameSaving || name === initialName}
								onClick={handleNameSave}
							>
								Save
							</Button>
						</div>
						{nameError && (
							<p className="text-sm text-destructive">{nameError}</p>
						)}
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor="settings-email">Email</Label>
						<div className="flex gap-2">
							<Input
								id="settings-email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
							/>
							<Button
								type="button"
								variant="outline"
								disabled={emailSaving || email === initialEmail}
								onClick={handleEmailSave}
							>
								Save
							</Button>
						</div>
						{emailError && (
							<p className="text-sm text-destructive">{emailError}</p>
						)}
					</div>

					<Separator />

					<div className="flex flex-col gap-2">
						<Label htmlFor="settings-current-password">Change password</Label>
						<Input
							id="settings-current-password"
							type="password"
							placeholder="Current password"
							autoComplete="current-password"
							value={currentPassword}
							onChange={(e) => setCurrentPassword(e.target.value)}
						/>
						<Input
							type="password"
							placeholder="New password"
							autoComplete="new-password"
							minLength={8}
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
						/>
						<Button
							type="button"
							variant="outline"
							disabled={passwordSaving || !currentPassword || !newPassword}
							onClick={handlePasswordSave}
						>
							{passwordSaving ? "Saving…" : "Update password"}
						</Button>
						{passwordError && (
							<p className="text-sm text-destructive">{passwordError}</p>
						)}
						{passwordSuccess && (
							<p className="text-sm text-muted-foreground">Password updated.</p>
						)}
					</div>

					<Separator />

					<div className="flex flex-col gap-2">
						<Label>Delete account</Label>
						<p className="text-sm text-muted-foreground">
							Permanently deletes your account. This can't be undone.
						</p>
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button type="button" variant="destructive">
									Delete account
								</Button>
							</AlertDialogTrigger>
							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Delete your account?</AlertDialogTitle>
									<AlertDialogDescription>
										This permanently deletes your account and can't be undone.
										Enter your password to confirm.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<Input
									type="password"
									placeholder="Password"
									autoComplete="current-password"
									value={deletePassword}
									onChange={(e) => setDeletePassword(e.target.value)}
								/>
								{deleteError && (
									<p className="text-sm text-destructive">{deleteError}</p>
								)}
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<Button
										type="button"
										variant="destructive"
										disabled={deleting || !deletePassword}
										onClick={handleDeleteAccount}
									>
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
