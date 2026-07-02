"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SettingsDialog } from "@/components/settings-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/auth-client";

function initialsFor(name: string) {
	return name
		.trim()
		.split(/\s+/)
		.map((part) => part[0])
		.slice(0, 2)
		.join("")
		.toUpperCase();
}

export function UserMenu({
	name,
	email,
	image,
}: {
	name: string;
	email: string;
	image: string | null | undefined;
}) {
	const router = useRouter();
	const [settingsOpen, setSettingsOpen] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						type="button"
						aria-label="Account menu"
						className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
					>
						<Avatar className="size-9">
							{image && <AvatarImage src={image} alt={name} />}
							<AvatarFallback>{initialsFor(name)}</AvatarFallback>
						</Avatar>
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end">
					<DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
						Settings
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem
						variant="destructive"
						onSelect={async () => {
							await signOut();
							router.push("/login");
						}}
					>
						Sign out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
			<SettingsDialog
				open={settingsOpen}
				onOpenChange={setSettingsOpen}
				name={name}
				email={email}
				image={image}
			/>
		</>
	);
}
