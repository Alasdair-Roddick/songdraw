import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Realtime-only client. It never queries tables — see lib/realtime.ts for why
// the socket carries signals rather than data. Null when unconfigured so the
// app degrades to SWR polling instead of throwing at import time.
export const supabase =
	url && publishableKey ? createClient(url, publishableKey) : null;
