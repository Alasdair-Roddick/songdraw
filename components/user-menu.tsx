"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
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

/**
 * The `.dark` palette existed for months with no way to reach it — next-themes
 * was installed but never imported. Renders nothing until mounted: the resolved
 * theme isn't known on the server, so labelling the button before hydration
 * would mean rendering the wrong one and then swapping it.
 */
function DarkroomToggle() {
	const { resolvedTheme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	if (!mounted) return null;

	const dark = resolvedTheme === "dark";
	return (
		<DropdownMenuItem
			// Not `onSelect={() => setTheme(...)}` alone — the menu closes on
			// select, and closing plus a full repaint in the same frame is where
			// the flash comes from.
			onSelect={(event) => {
				event.preventDefault();
				setTheme(dark ? "light" : "dark");
			}}
		>
			{dark ? <SunIcon /> : <MoonIcon />}
			{dark ? "Daylight" : "Darkroom"}
		</DropdownMenuItem>
	);
}

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
						className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-brand/60"
					>
						<Avatar className="size-9 ring-2 ring-foreground">
							{image && <AvatarImage src={image} alt={name} />}
							<AvatarFallback>{initialsFor(name)}</AvatarFallback>
						</Avatar>
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent
					align="end"
					className="rounded-(--radius-frame) border-2 border-rule"
				>
					<DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
						Settings
					</DropdownMenuItem>
					<DarkroomToggle />
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
