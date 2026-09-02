"use client";

import { CheckIcon, SearchIcon, UserPlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Result = {
	id: string;
	name: string;
	image: string | null;
	invited: boolean;
};

export function InviteMemberDialog({ gameId }: { gameId: string }) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<Result[]>([]);
	const [searching, setSearching] = useState(false);
	const [inviting, setInviting] = useState<string | null>(null);

	// Debounced so a fast typist doesn't fan out a request per keystroke.
	useEffect(() => {
		const q = query.trim();
		if (q.length < 2) {
			setResults([]);
			return;
		}

		const controller = new AbortController();
		const timer = setTimeout(async () => {
			setSearching(true);
			try {
				const res = await fetch(
					`/api/users/search?gameId=${gameId}&q=${encodeURIComponent(q)}`,
					{ signal: controller.signal },
				);
				if (res.ok) setResults(await res.json());
			} catch {
				// Aborted by the next keystroke — nothing to report.
			} finally {
				setSearching(false);
			}
		}, 250);

		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [query, gameId]);

	async function invite(person: Result) {
		setInviting(person.id);
		const res = await fetch(`/api/games/${gameId}/invites`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ userId: person.id }),
		});
		setInviting(null);

		if (!res.ok) {
			const body = await res.json().catch(() => null);
			toast.error(body?.error ?? "Couldn't send that invite — try again.");
			return;
		}

		setResults((current) =>
			current.map((r) => (r.id === person.id ? { ...r, invited: true } : r)),
		);
		toast.success(`Invited ${person.name}`);
		router.refresh();
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) {
					setQuery("");
					setResults([]);
				}
			}}
		>
			<DialogTrigger asChild>
				<Button type="button" variant="outline" className="rounded-full">
					<UserPlusIcon />
					Invite
				</Button>
			</DialogTrigger>
			<DialogContent className="rounded-none border-2 border-foreground">
				<DialogHeader>
					<DialogTitle>Invite someone</DialogTitle>
					<DialogDescription>
						Search by display name. They'll get a notification to accept.
					</DialogDescription>
				</DialogHeader>

				<div className="relative">
					<SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Start typing a name…"
						className="rounded-full pl-9"
						autoFocus
					/>
				</div>

				{query.trim().length >= 2 && (
					// min-w-0 so a long display name truncates rather than widening
					// the list past the dialog — see the note in song-search.tsx.
					<div className="min-w-0 border-2 border-foreground">
						{searching && results.length === 0 ? (
							<p className="p-4 text-center font-mono text-sm text-muted-foreground">
								Searching…
							</p>
						) : results.length === 0 ? (
							<p className="p-4 text-center font-mono text-sm text-muted-foreground">
								Nobody by that name.
							</p>
						) : (
							<ul className="divide-y-2 divide-foreground">
								{results.map((person) => (
									<li
										key={person.id}
										className="flex items-center justify-between gap-3 p-2.5"
									>
										<div className="flex min-w-0 items-center gap-2.5">
											<Avatar>
												{person.image && (
													<AvatarImage src={person.image} alt={person.name} />
												)}
												<AvatarFallback>
													{person.name.charAt(0).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<span className="truncate font-medium">
												{person.name}
											</span>
										</div>
										{person.invited ? (
											<span className="flex shrink-0 items-center gap-1 font-mono text-xs tracking-widest uppercase text-muted-foreground">
												<CheckIcon className="size-3.5" />
												Invited
											</span>
										) : (
											<Button
												type="button"
												variant="brand"
												size="sm"
												className="shrink-0 rounded-full"
												disabled={inviting === person.id}
												onClick={() => invite(person)}
											>
												Invite
											</Button>
										)}
									</li>
								))}
							</ul>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
