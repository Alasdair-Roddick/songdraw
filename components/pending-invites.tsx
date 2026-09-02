"use client";

import { XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export type PendingInvite = {
	id: string;
	invitee: { id: string; name: string; image: string | null };
};

export function PendingInvites({ invites }: { invites: PendingInvite[] }) {
	const router = useRouter();
	const [cancelling, setCancelling] = useState<string | null>(null);

	async function cancel(invite: PendingInvite) {
		setCancelling(invite.id);
		const res = await fetch(`/api/invites/${invite.id}`, { method: "DELETE" });
		setCancelling(null);

		if (!res.ok) {
			toast.error("Couldn't cancel that invite — try again.");
			return;
		}
		toast.success(`Cancelled ${invite.invitee.name}'s invite`);
		router.refresh();
	}

	return (
		<ul className="divide-y-2 divide-foreground border-2 border-foreground">
			{invites.map((invite) => (
				<li
					key={invite.id}
					className="flex items-center justify-between gap-3 p-3"
				>
					<div className="flex min-w-0 items-center gap-2.5">
						<Avatar>
							{invite.invitee.image && (
								<AvatarImage
									src={invite.invitee.image}
									alt={invite.invitee.name}
								/>
							)}
							<AvatarFallback>
								{invite.invitee.name.charAt(0).toUpperCase()}
							</AvatarFallback>
						</Avatar>
						<span className="truncate font-medium">{invite.invitee.name}</span>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<span className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
							Pending
						</span>
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							aria-label={`Cancel invite to ${invite.invitee.name}`}
							disabled={cancelling === invite.id}
							onClick={() => cancel(invite)}
						>
							<XIcon />
						</Button>
					</div>
				</li>
			))}
		</ul>
	);
}
