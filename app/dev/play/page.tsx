import { notFound } from "next/navigation";
import { PlayPreview } from "@/components/play-preview";
import { isDevMode } from "@/lib/dev-mode";

// Design harness for the play surface. It renders the real feed against
// synthetic rounds so panel sizing can be checked at any room size and in
// every round state without waiting for a draw or joining eight games.
//
// Gated the same way as the dev round controls: NODE_ENV is the hard boundary,
// so copying DEV_MODE into production can't expose it.
export default function DevPlayPage() {
	if (!isDevMode()) notFound();
	return <PlayPreview />;
}
