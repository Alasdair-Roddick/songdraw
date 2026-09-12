import { CheckIcon, CircleIcon, CircleXIcon } from "lucide-react";
import { usernameRules } from "@/lib/username";
import { cn } from "@/lib/utils";

export function UsernameHint({ name, id }: { name: string; id: string }) {
	const rules = usernameRules(name);
	return (
		<div
			id={id}
			className="flex flex-wrap gap-x-3 gap-y-1 text-xs"
			aria-live="polite"
			aria-atomic="true"
		>
			{[
				{ label: "No spaces", valid: rules.noSpaces },
				{ label: "A–Z, 0–9, - and _ only", valid: rules.allowedCharacters },
			].map(({ label, valid }) => {
				const state = !name ? "neutral" : valid ? "valid" : "invalid";
				const Icon =
					state === "neutral" ? CircleIcon : valid ? CheckIcon : CircleXIcon;
				return (
					<span
						key={label}
						className={cn(
							"inline-flex items-center gap-1.5",
							state === "invalid"
								? "text-destructive"
								: state === "valid"
									? "text-foreground"
									: "text-muted-foreground",
						)}
					>
						<Icon className="size-3.5 shrink-0" aria-hidden="true" />
						<span className="sr-only">
							{state === "neutral"
								? "Required: "
								: valid
									? "Met: "
									: "Not met: "}
						</span>
						{label}
					</span>
				);
			})}
		</div>
	);
}
