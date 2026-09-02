import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Realtime-only client. It never queries tables — see lib/realtime.ts for why
// the socket carries signals rather than data. Null when unconfigured so the
// app degrades to SWR polling instead of throwing at import time.
export const supabase = url && anonKey ? createClient(url, anonKey) : null;
