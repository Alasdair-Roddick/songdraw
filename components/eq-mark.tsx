import { cn } from "@/lib/utils";

const EQ_BARS = [
	{ delay: "0s", duration: "0.9s" },
	{ delay: "-0.3s", duration: "1.15s" },
	{ delay: "-0.6s", duration: "0.8s" },
	{ delay: "-0.15s", duration: "1.05s" },
	{ delay: "-0.45s", duration: "0.95s" },
];

export function EqMark({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"flex h-11 w-11 items-end justify-center gap-[3px] rounded-md bg-primary px-2.5 py-2",
				className,
			)}
		>
			{EQ_BARS.map((bar) => (
				<span
					key={bar.delay + bar.duration}
					className="h-full w-[3px] origin-bottom animate-[equalize_1s_ease-in-out_infinite] rounded-full bg-primary-foreground motion-reduce:animate-none"
					style={{
						animationDelay: bar.delay,
						animationDuration: bar.duration,
					}}
				/>
			))}
		</div>
	);
}
