"use client";

import { CheckIcon, LoaderCircleIcon } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const TITLE_LIMIT = 200;
const BODY_LIMIT = 4000;

const CATEGORIES = [
	{ value: "gameplay", label: "Gameplay" },
	{ value: "bug", label: "Bug" },
	{ value: "design", label: "Design" },
	{ value: "other", label: "Other" },
] as const;

/** Minted once per request, reused on every retry of it. A retry under a fresh
 * key files a second copy; the key is only rolled after one is safely filed. */
const newKey = () => crypto.randomUUID();

function SectionLabel({ children }: { children: React.ReactNode }) {
	return (
		<span className="font-mono text-xs font-semibold tracking-widest text-muted-foreground uppercase">
			{children}
		</span>
	);
}

export function FeatureRequestForm({ email }: { email: string }) {
	const [clientKey, setClientKey] = useState(newKey);
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [category, setCategory] = useState<string>("");
	const [sending, setSending] = useState(false);
	const [sent, setSent] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const ready = title.trim().length > 0 && body.trim().length > 0;

	async function submit(event: React.FormEvent) {
		event.preventDefault();
		if (!ready || sending) return;

		setSending(true);
		setError(null);

		const res = await fetch("/api/feature-request", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ clientKey, title, body, category }),
		}).catch(() => null);
		setSending(false);

		if (!res) {
			setError("Couldn't reach the server — check your connection.");
			return;
		}

		const payload = await res.json().catch(() => null);
		if (!res.ok) {
			setError(payload?.error ?? "We couldn't file that just now.");
			return;
		}

		if (payload?.duplicate) {
			// Same key, same text: the console already had it. Nothing was sent
			// a second time, and saying so beats a silent success.
			toast.info("You've already sent this one.");
		} else {
			toast.success("Feature request sent", {
				description: `We'll reply to ${email}.`,
			});
		}

		// Filed. A new key from here, so the next request is a new request
		// rather than a duplicate of this one.
		setClientKey(newKey());
		setTitle("");
		setBody("");
		setCategory("");
		setSent(true);
	}

	if (sent) {
		return (
			<div className="flex flex-col items-start gap-4 rounded-(--radius-frame) border-2 border-rule p-6 shadow-(--shadow-lift-lg)">
				<span className="flex size-11 items-center justify-center rounded-full bg-brand text-brand-foreground">
					<CheckIcon className="size-6" />
				</span>
				<div className="space-y-1.5">
					<h2 className="font-display text-2xl font-extrabold tracking-tight">
						Sent
					</h2>
					<p className="font-mono text-sm text-muted-foreground">
						A confirmation is on its way to {email}. You'll hear back there when
						it's picked up.
					</p>
				</div>
				<Button
					variant="outline"
					className="rounded-full"
					onClick={() => setSent(false)}
				>
					Send another
				</Button>
			</div>
		);
	}

	return (
		<form
			onSubmit={submit}
			className="space-y-6 rounded-(--radius-frame) border-2 border-rule p-6 shadow-(--shadow-lift-lg)"
		>
			<div className="space-y-2">
				<Label htmlFor="feature-title">
					<SectionLabel>Title</SectionLabel>
				</Label>
				<Input
					id="feature-title"
					value={title}
					onChange={(e) => setTitle(e.target.value.slice(0, TITLE_LIMIT))}
					placeholder="Let me undo a guess"
					autoComplete="off"
					maxLength={TITLE_LIMIT}
					required
				/>
			</div>

			<div className="space-y-2">
				<div className="flex items-baseline justify-between gap-3">
					<Label htmlFor="feature-body">
						<SectionLabel>What you want</SectionLabel>
					</Label>
					<span className="font-mono text-xs text-muted-foreground tabular-nums">
						{body.length}/{BODY_LIMIT}
					</span>
				</div>
				<Textarea
					id="feature-body"
					value={body}
					onChange={(e) => setBody(e.target.value.slice(0, BODY_LIMIT))}
					placeholder="I keep fat-fingering the picker and there's no way back."
					className="min-h-40"
					maxLength={BODY_LIMIT}
					required
				/>
			</div>

			<div className="space-y-2">
				<SectionLabel>Category</SectionLabel>
				<div className="flex flex-wrap gap-2">
					{CATEGORIES.map((option) => {
						const selected = category === option.value;
						return (
							<button
								key={option.value}
								type="button"
								aria-pressed={selected}
								// Selecting toggles off, so "none" stays reachable once
								// something has been picked.
								onClick={() => setCategory(selected ? "" : option.value)}
								className={`h-11 rounded-full border-2 border-rule-strong px-4 text-sm font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-brand/60 ${
									selected ? "bg-brand text-brand-foreground" : "hover:bg-muted"
								}`}
							>
								{option.label}
							</button>
						);
					})}
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

			<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<Button
					type="submit"
					variant="brand"
					className="h-12 rounded-full text-base"
					disabled={!ready || sending}
				>
					{sending && <LoaderCircleIcon className="animate-spin" />}
					{sending ? "Sending" : "Send request"}
				</Button>
				<p className="font-mono text-xs text-muted-foreground">
					We'll email {email} to confirm, and again when it's picked up.
				</p>
			</div>
		</form>
	);
}
