import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when Supabase env vars are present. Used to fall back to local data. */
export const supabaseConfigured = Boolean(url && anonKey);

/**
 * Read-only client for the public site (anon key + RLS → only `published` rows).
 * Returns null when not configured, so callers can fall back to local data and
 * the app keeps working on localhost before Supabase is set up.
 */
export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  return createClient(url!, anonKey!, {
    auth: { persistSession: false },
    global: {
      // supabase-js issues its queries through fetch, and Next.js caches fetch
      // in Server Components. That cached a response from a moment when no
      // stories were published, so publishing one in the admin never changed
      // the public page — the query was never actually re-run. Page-level
      // `force-dynamic` does not help, because the staleness is in the fetch
      // layer beneath it.
      //
      // This data changes outside the request cycle (an admin publishing or
      // taking something down), so a cached read is always wrong here.
      fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
