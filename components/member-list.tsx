"use client";

import {
	CrownIcon,
	LogOutIcon,
	MoreHorizontalIcon,
	UserXIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type Member = {
	id: string;
	role: string;
	user: { id: string; name: string; image: string | null };
};

type Confirm =
	| { kind: "remove"; member: Member }
	| { kind: "transfer"; member: Member }
	| { kind: "leave"; member: Member };

export function MemberList({
	gameId,
	members,
	viewerId,
	viewerIsOwner,
}: {
	gameId: string;
	members: Member[];
	viewerId: string;
	viewerIsOwner: boolean;
}) {
	const router = useRouter();
	const [confirm, setConfirm] = useState<Confirm | null>(null);
	const [busy, setBusy] = useState(false);

	async function run() {
		if (!confirm) return;
		setBusy(true);

		const { kind, member } = confirm;
		const res =
			kind === "transfer"
				? await fetch(`/api/games/${gameId}/owner`, {
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ userId: member.user.id }),
					})
				: await fetch(`/api/games/${gameId}/members/${member.id}`, {
						method: "DELETE",
					});

		setBusy(false);
		setConfirm(null);

		if (!res.ok) {
			const body = await res.json().catch(() => null);
			toast.error(body?.error ?? "That didn't work — try again.");
			return;
		}

		if (kind === "leave") {
			toast.success("You left the game.");
			router.push("/home");
			return;
		}
		toast.success(
			kind === "transfer"
				? `${member.user.name} owns this game now`
				: `Removed ${member.user.name}`,
		);
		router.refresh();
	}

	const copy = {
		remove: {
			title: "Remove this person?",
			body: "They lose access to the game and their pooled songs retire with them.",
			action: "Remove",
		},
		transfer: {
			title: "Hand over the game?",
			body: "They become the owner and you become a regular member. Only they can hand it back.",
			action: "Hand over",
		},
		leave: {
			title: "Leave this game?",
			body: "Your pooled songs retire with you. You'd need a new invite to come back.",
			action: "Leave",
		},
	} as const;

	return (
		<>
			<ul className="divide-y-2 divide-foreground border-2 border-foreground">
				{members.map((member) => {
					const isSelf = member.user.id === viewerId;
					const isOwner = member.role === "owner";
					// The owner can act on everyone but themselves; everyone else gets
					// exactly one action — leaving.
					const canManage = viewerIsOwner && !isSelf;
					const canLeave = isSelf && !isOwner;

					return (
						<li
							key={member.id}
							className="flex items-center justify-between gap-3 p-3"
						>
							<div className="flex min-w-0 items-center gap-2.5">
								<Avatar>
									{member.user.image && (
										<AvatarImage
											src={member.user.image}
											alt={member.user.name}
										/>
									)}
									<AvatarFallback>
										{member.user.name.charAt(0).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<span className="truncate font-medium">
									{member.user.name}
									{isSelf && (
										<span className="ml-1.5 font-mono text-xs text-muted-foreground">
											you
										</span>
									)}
								</span>
							</div>

							<div className="flex shrink-0 items-center gap-2">
								{isOwner && (
									<span className="flex items-center gap-1 font-mono text-xs tracking-widest uppercase text-muted-foreground">
										<CrownIcon className="size-3.5" />
										Owner
									</span>
								)}
								{(canManage || canLeave) && (
									<DropdownMenu>
										<DropdownMenuTrigger asChild>
											<Button
												type="button"
												variant="ghost"
												size="icon-sm"
												aria-label={`Manage ${member.user.name}`}
											>
												<MoreHorizontalIcon />
											</Button>
										</DropdownMenuTrigger>
										<DropdownMenuContent
											align="end"
											className="rounded-none border-2 border-foreground"
										>
											{canManage && (
												<>
													<DropdownMenuItem
														onSelect={() =>
															setConfirm({ kind: "transfer", member })
														}
													>
														<CrownIcon />
														Make owner
													</DropdownMenuItem>
													<DropdownMenuItem
														variant="destructive"
														onSelect={() =>
															setConfirm({ kind: "remove", member })
														}
													>
														<UserXIcon />
														Remove
													</DropdownMenuItem>
												</>
											)}
											{canLeave && (
												<DropdownMenuItem
													variant="destructive"
													onSelect={() => setConfirm({ kind: "leave", member })}
												>
													<LogOutIcon />
													Leave game
												</DropdownMenuItem>
											)}
										</DropdownMenuContent>
									</DropdownMenu>
								)}
							</div>
						</li>
					);
				})}
			</ul>

			<AlertDialog
				open={confirm !== null}
				onOpenChange={(open) => !open && setConfirm(null)}
			>
				<AlertDialogContent className="rounded-none border-2 border-foreground">
					{confirm && (
						<>
							<AlertDialogHeader>
								<AlertDialogTitle>{copy[confirm.kind].title}</AlertDialogTitle>
								<AlertDialogDescription>
									{copy[confirm.kind].body}
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel className="rounded-full">
									Cancel
								</AlertDialogCancel>
								<AlertDialogAction
									disabled={busy}
									onClick={(e) => {
										e.preventDefault();
										run();
									}}
									className="rounded-full"
								>
									{copy[confirm.kind].action}
								</AlertDialogAction>
							</AlertDialogFooter>
						</>
					)}
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
