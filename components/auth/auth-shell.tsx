const EQ_BARS = [
	{ delay: "0s", duration: "0.9s" },
	{ delay: "-0.3s", duration: "1.15s" },
	{ delay: "-0.6s", duration: "0.8s" },
	{ delay: "-0.15s", duration: "1.05s" },
	{ delay: "-0.45s", duration: "0.95s" },
];

export function AuthShell({ children }: { children: React.ReactNode }) {
	return (
		<div className="relative flex flex-1 items-center justify-center overflow-hidden px-6 py-10">
			<div aria-hidden className="pointer-events-none absolute inset-0">
				<div className="absolute -top-32 -left-24 size-96 rounded-full bg-violet-500/15 blur-3xl" />
				<div className="absolute -right-24 -bottom-32 size-96 rounded-full bg-fuchsia-500/10 blur-3xl" />
			</div>
			<div className="relative flex w-full max-w-sm flex-col items-center gap-6">
				<div className="flex items-center gap-3">
					<div className="flex h-11 w-11 items-end justify-center gap-[3px] rounded-xl bg-primary px-2.5 py-2 shadow-lg">
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
					<span className="font-heading text-2xl font-semibold tracking-tight">
						SongDraw
					</span>
				</div>
				{children}
			</div>
		</div>
	);
}
