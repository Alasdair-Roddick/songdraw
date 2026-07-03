"use client";

import { EyeIcon, EyeOffIcon, LockIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PasswordInput({
	className,
	...props
}: Omit<React.ComponentProps<"input">, "type">) {
	const [show, setShow] = useState(false);

	return (
		<div className="relative">
			<LockIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type={show ? "text" : "password"}
				className={cn("h-10 pr-10 pl-9", className)}
				{...props}
			/>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className="absolute top-1/2 right-1.5 -translate-y-1/2 text-muted-foreground"
				aria-label={show ? "Hide password" : "Show password"}
				onClick={() => setShow((v) => !v)}
			>
				{show ? <EyeOffIcon /> : <EyeIcon />}
			</Button>
		</div>
	);
}
