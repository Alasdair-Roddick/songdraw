"use client";

import { CircleCheckIcon, InfoIcon, OctagonXIcon } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// Light-mode-first per the style guide, so no next-themes lookup: flat surface,
// hard 2px rule, hard offset shadow, square corners.
const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			className="toaster group"
			icons={{
				success: <CircleCheckIcon className="size-4" />,
				info: <InfoIcon className="size-4" />,
				error: <OctagonXIcon className="size-4" />,
			}}
			toastOptions={{
				classNames: {
					toast:
						"!rounded-(--radius-frame) !border-2 !border-rule !bg-background !text-foreground !shadow-(--shadow-lift)",
					title: "!font-bold !tracking-tight",
					description: "!font-mono !text-xs !text-muted-foreground",
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };
