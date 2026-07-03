import { EqMark } from "@/components/eq-mark";

export function AuthShell({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex flex-1 items-center justify-center px-6 py-10">
			<div className="flex w-full max-w-sm flex-col items-center gap-6">
				<div className="flex items-center gap-2.5">
					<EqMark className="h-9 w-9 px-2 py-1.5" />
					<span className="text-lg font-bold tracking-tighter">SongDraw</span>
				</div>
				{children}
			</div>
		</div>
	);
}
